/**
 * `make gates` after the Test job's catalog refresh, in a scratch copy of this tree.
 *
 * The Test job of `package-release.yml` first moves every IGNIS package to the highest published line
 * (`refresh-catalog.ts`, `force-update`, `bun install`) and only then runs the gates. A plain checkout
 * never sees what that refresh moves, and two dispatches failed on it. This replays the job in a copy
 * that is a git repository of its own, so lint and the build-info test see a checkout:
 *
 *   bun scripts/release/gates-refreshed.ts        (or `make gates-refreshed`)
 *
 * The refresh commands and the VULCAN the preset smoke runs are read from the workflow, never copied by
 * hand: a workflow that no longer has the step, or whose block changed shape, makes this fail (and
 * `__tests__/gates-refreshed.test.ts` with it) instead of running something else. It prints the scratch
 * folder, runs the steps in order and exits with the exit code of `make gates`; the copy is removed on a
 * pass and kept on a failure.
 */

import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { makeScratch } from '../scratch';

const ROOT = resolve(import.meta.dir, '..', '..');

export interface IRefreshStep {
  label: string;
  /** The command, run by `bash -ec` from the scratch folder. */
  script: string;
}

export class GatesRefreshed {
  static readonly WORKFLOW = '.github/workflows/package-release.yml';

  static readonly REFRESH_STEP = 'Force update workspace';

  static readonly SMOKE_STEP = 'VULCAN preset smoke';

  /** The env of the Test job of a prerelease dispatch: the IGNIS line is the highest, the packages are all four. */
  static readonly ENV = {
    CATALOG_TAG: 'highest',
    BUILD_MODE: 'prerelease',
    PACKAGES: 'kernel,react,admin,ardor',
  } as const;

  /** What the refresh block may hold: each line is one of these, so a changed block fails here, not on a runner. */
  static readonly REFRESH_LINES = [
    /^bun scripts\/build\/refresh-catalog\.ts "\$CATALOG_TAG"$/,
    /^bun run --filter "@venizia\/\*" force-update "\$CATALOG_TAG"$/,
  ];

  /** The text of the `test` job: from `  test:` under `jobs:` to the next job. */
  static testJobOf(opts: { workflow: string }): string {
    const section = opts.workflow.split(/\njobs:\n/)[1] ?? '';
    const starts = [...section.matchAll(/^  ([\w-]+):\s*$/gm)];
    const index = starts.findIndex((start) => start[1] === 'test');
    if (index === -1) {
      throw new Error(`[gates-refreshed] no 'test' job in ${GatesRefreshed.WORKFLOW}`);
    }

    return section.slice(starts[index]?.index ?? 0, starts[index + 1]?.index ?? section.length);
  }

  /** The text of one step of the Test job, from its name line to the next step. */
  static stepOf(opts: { workflow: string; name: string }): string {
    const job = GatesRefreshed.testJobOf({ workflow: opts.workflow });
    const step = job.split(/\n {6}- name: /).find((chunk) => chunk.split('\n')[0] === opts.name);
    if (step === undefined) {
      throw new Error(
        `[gates-refreshed] no step '${opts.name}' in the Test job of ${GatesRefreshed.WORKFLOW}`,
      );
    }

    return step;
  }

  /** The `run:` block of the refresh step, without comment lines; throws when it is not the two known commands. */
  static refreshCommands(opts: { workflow: string }): string[] {
    const step = GatesRefreshed.stepOf({
      workflow: opts.workflow,
      name: GatesRefreshed.REFRESH_STEP,
    });
    const block = step.split(/\n {8}run: \|\n/)[1] ?? '';
    const lines = block
      .split('\n')
      .filter((line) => /^ {10}\S/.test(line))
      .map((line) => line.trim())
      .filter((line) => !line.startsWith('#'));

    const shape = GatesRefreshed.REFRESH_LINES;
    if (lines.length !== shape.length || lines.some((line, i) => !shape[i]?.test(line))) {
      throw new Error(
        `[gates-refreshed] the run block of '${GatesRefreshed.REFRESH_STEP}' is not the two refresh commands | found ${JSON.stringify(lines)}`,
      );
    }

    return lines;
  }

  /** The `VULCAN_CMD` the preset smoke step sets: the VULCAN this repository pins. */
  static vulcanCmd(opts: { workflow: string }): string {
    const step = GatesRefreshed.stepOf({
      workflow: opts.workflow,
      name: GatesRefreshed.SMOKE_STEP,
    });
    const found = step.match(/^ {10}VULCAN_CMD: (\S.*)$/m)?.[1]?.trim();
    if (found === undefined || found === '') {
      throw new Error(`[gates-refreshed] step '${GatesRefreshed.SMOKE_STEP}' sets no VULCAN_CMD`);
    }

    return found;
  }

  /** The steps in the order the Test job runs them: refresh, install, gates. */
  static steps(opts: { workflow: string }): IRefreshStep[] {
    return [
      {
        label: GatesRefreshed.REFRESH_STEP,
        script: GatesRefreshed.refreshCommands(opts).join('\n'),
      },
      { label: 'Install', script: 'bun install' },
      { label: 'Gates', script: 'make gates' },
    ];
  }

  /** A copy of this tree without what a checkout does not have, committed in a repository of its own. */
  static copyTree(opts: { to: string }): void {
    // tar, not cpSync: the scratch folder lies inside this tree, which cpSync refuses as a copy into itself.
    const copied = Bun.spawnSync(
      [
        'bash',
        '-c',
        'set -o pipefail; tar -C "$1" --exclude=node_modules --exclude=dist --exclude=.git --exclude=.agents/local -cf - . | tar -xf - -C "$2"',
        'copy',
        ROOT,
        opts.to,
      ],
      { stdout: 'ignore' },
    );
    if (copied.exitCode !== 0) {
      throw new Error(`[gates-refreshed] copying ${ROOT} to ${opts.to} failed`);
    }

    for (const args of [
      ['init', '-q'],
      ['add', '-A'],
      [
        '-c',
        'user.name=scratch',
        '-c',
        'user.email=scratch@example.invalid',
        'commit',
        '-qm',
        'scratch',
      ],
    ]) {
      const done = Bun.spawnSync(['git', ...args], { cwd: opts.to, stdout: 'ignore' });
      if (done.exitCode !== 0) {
        throw new Error(`[gates-refreshed] git ${args.join(' ')} failed in ${opts.to}`);
      }
    }
  }

  /** Runs every step in the scratch copy; returns the exit code of the first one that fails, else that of `make gates`. */
  static async run(): Promise<number> {
    const workflow = readFileSync(resolve(ROOT, GatesRefreshed.WORKFLOW), 'utf8');
    const steps = GatesRefreshed.steps({ workflow });
    const env = {
      ...process.env,
      ...GatesRefreshed.ENV,
      VULCAN_CMD: GatesRefreshed.vulcanCmd({ workflow }),
    };

    const scratch = makeScratch({ prefix: 'gates-refreshed-' });
    console.log(`[gates-refreshed] scratch copy: ${scratch}`);
    GatesRefreshed.copyTree({ to: scratch });

    for (const step of steps) {
      console.log(`[gates-refreshed] ${step.label}`);
      const proc = Bun.spawn(['bash', '-ec', step.script], {
        cwd: scratch,
        env,
        stdout: 'inherit',
        stderr: 'inherit',
      });
      const code = await proc.exited;
      if (code !== 0) {
        console.error(
          `[gates-refreshed] ${step.label} failed (exit ${code}); the copy stays: ${scratch}`,
        );
        return code;
      }
    }

    // It holds node_modules: kept on a failure, to look into, removed on a pass.
    rmSync(scratch, { recursive: true, force: true });

    return 0;
  }
}

if (import.meta.main) {
  try {
    const result = await GatesRefreshed.run();
    process.exit(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
