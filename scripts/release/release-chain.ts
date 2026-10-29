/**
 * Releases the planned packages in dependency order, in one run.
 *
 * The workflow calls this file in one step. The steps of a package are data (`ReleaseChain.plan`), so
 * a test reads the exact command sequence; `runChain` executes them through injected ports (a command
 * runner, the registry, git, the clock), so a test can fail any step and see what is left behind.
 *
 *   bun scripts/release/release-chain.ts --packages kernel,react,admin,ardor --version 0.4.6-0
 *       [--issue N] [--branch release-123] [--tarballs <dir>] [--tmp <dir>] [--state <file>] [--dry-run]
 *
 * Phase A checks every package that will be released, before the first publish: links, build,
 * artifacts, pack, protocols and registry. Phase B releases one package at a time: clean-install (its
 * siblings are read from the registry, so the previous package must be installable first), bump, the
 * preset (ardor), the tarball that is published, its sha256, the publish, the wait for the tarball to
 * answer 200, the dist-tags, then the release commit, the push and the tag. After any stop git equals
 * the registry: a package has its commit and its tag, or it was not published.
 *
 * The publish is the one step that cannot be undone, so it runs before every git write of its package,
 * and the "a publish was attempted" state is recorded BEFORE the call (a lost response still leaves npm
 * holding the version). A rejected push stops the run: the chain never rebases, because a rebase would
 * pull commits the tests never saw into the tree that later packages are built and published from.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { npmTagFor } from './release-version';
import { waitForTarball } from './release-wait';

/** How far a package got. A report is built from the last stage it reached. */
export type TStage = 'none' | 'attempted' | 'published' | 'committed' | 'pushed' | 'tagged';

const STAGES: readonly TStage[] = [
  'none',
  'attempted',
  'published',
  'committed',
  'pushed',
  'tagged',
];

export type TStep =
  | { kind: 'run'; label: string; command: string[]; cwd?: string; fatal: boolean; stage?: TStage }
  | { kind: 'manifest'; label: string; tarball: string; out: string }
  | { kind: 'record-sha'; label: string; tarball: string }
  | { kind: 'verify-sha'; label: string; tarball: string }
  | { kind: 'publish'; label: string; command: string[]; cwd?: string }
  | { kind: 'wait'; label: string }
  | { kind: 'push-tag'; label: string; tag: string };

export interface IChainPackage {
  /** The workspace folder name: kernel, react, admin, ardor. */
  name: string;
  /** The npm name, from the manifest. */
  packageName: string;
}

export interface IChainOptions {
  packages: readonly IChainPackage[];
  version: string;
  npmTag: string;
  issue?: string;
  /** The branch the release commits are made on; created once, before the first commit. */
  branch?: string;
  /** The folder the tarballs are written to (absolute: npm reads a relative `.tgz` as a package spec). */
  tarballs: string;
  /** A scratch folder for the manifests and the lockfile copy. */
  tmp: string;
  /** Where the state of every package is written after each step, for a report that outlives the process. */
  statePath?: string;
  /** The planned packages, as the registry gate may trust them (their workspace version). */
  chainReleased?: readonly string[];
}

export interface IChainPorts {
  run: (opts: { command: string[]; cwd?: string }) => Promise<{ exitCode: number; stdout: string }>;
  readManifest: (opts: { path: string }) => { name: string; version: string };
  /** Fresh, not cached: whether the registry holds the version. */
  hasVersion: (opts: { packageName: string; version: string }) => Promise<boolean>;
  tagOnOrigin: (opts: { tag: string }) => Promise<boolean>;
  waitForTarball: (opts: { packageName: string; version: string }) => Promise<void>;
  sha256: (opts: { path: string }) => Promise<string>;
  writeFile: (opts: { path: string; content: string }) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
}

export interface IPackageState {
  name: string;
  packageName: string;
  stage: TStage;
  skipped: boolean;
  sha?: string;
  warnings: string[];
}

export interface IChainResult {
  ok: boolean;
  states: IPackageState[];
  /** What the operator reads when the run stopped. */
  report?: string;
}

export class ReleaseChain {
  static readonly PUSH_ATTEMPTS = 3;

  static gate(opts: { args: string[] }): string[] {
    return ['bun', 'scripts/release/release-gates.ts', ...opts.args];
  }

  /** Phase A for one package: every check that needs no new sibling. */
  static checks(opts: { pkg: IChainPackage; options: IChainOptions }): TStep[] {
    const { pkg, options } = opts;
    const dir = `packages/${pkg.name}`;
    const packed = join(options.tmp, `packed-${pkg.name}.json`);
    const released = (options.chainReleased ?? []).join(',');

    return [
      {
        kind: 'run',
        label: `${pkg.name}: links`,
        command: ReleaseChain.gate({ args: ['links', dir] }),
        fatal: true,
      },
      { kind: 'run', label: `${pkg.name}: build`, command: ['make', pkg.name], fatal: true },
      {
        kind: 'run',
        label: `${pkg.name}: artifacts`,
        command: ReleaseChain.gate({ args: ['artifacts', dir] }),
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: pack`,
        command: ReleaseChain.gate({ args: ['pack', dir, packed] }),
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: protocols`,
        command: ReleaseChain.gate({ args: ['protocols', packed] }),
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: registry`,
        command: ReleaseChain.gate({ args: ['registry', packed, '--chain-released', released] }),
        fatal: true,
      },
    ];
  }

  /** Phase B for one package, in the order of the card (D7). */
  static release(opts: { pkg: IChainPackage; options: IChainOptions; first: boolean }): TStep[] {
    const { pkg, options, first } = opts;
    const { version, npmTag, tarballs, tmp } = options;
    const dir = `packages/${pkg.name}`;
    const tarball = join(tarballs, `${pkg.name}.tgz`);
    const tag = `${pkg.name}-v${version}`;
    const scratch = join(tmp, `relock-${pkg.name}`);
    const subject = `${options.issue === undefined ? '' : `[#${options.issue}] `}chore(${pkg.name}): release v${version} [${version}]`;

    return [
      {
        kind: 'run',
        label: `${pkg.name}: clean-install`,
        command: ['make', `clean-install-${pkg.name}`],
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: bump`,
        command: ['npm', 'version', version, '--no-git-tag-version', '--workspaces-update=false'],
        cwd: dir,
        fatal: true,
      },
      ...(pkg.name === 'ardor'
        ? [
            {
              kind: 'run',
              label: 'ardor: write the VULCAN preset',
              command: ['bun', 'scripts/preset/vulcan-preset.ts'],
              fatal: true,
            } as TStep,
          ]
        : []),
      {
        kind: 'run',
        label: `${pkg.name}: pack the tarball to publish`,
        command: ['bun', 'pm', 'pack', '--quiet', '--filename', tarball],
        cwd: dir,
        fatal: true,
      },
      {
        kind: 'manifest',
        label: `${pkg.name}: check the packed manifest`,
        tarball,
        out: join(tmp, `published-${pkg.name}.json`),
      },
      { kind: 'record-sha', label: `${pkg.name}: record the sha256`, tarball },
      { kind: 'verify-sha', label: `${pkg.name}: check the sha256`, tarball },
      {
        kind: 'publish',
        label: `${pkg.name}: publish`,
        command: [
          'npm',
          'publish',
          tarball,
          '--access',
          'public',
          '--tag',
          npmTag,
          '--ignore-scripts',
          '--provenance',
        ],
      },
      { kind: 'wait', label: `${pkg.name}: wait for the tarball to answer 200` },
      {
        kind: 'run',
        label: `${pkg.name}: tag highest`,
        command: ['npm', 'dist-tag', 'add', `${pkg.packageName}@${version}`, 'highest'],
        fatal: false,
      },
      {
        kind: 'run',
        label: `${pkg.name}: keep next at or above latest`,
        command: ReleaseChain.gate({
          args: ['heal-next', '--published', `${pkg.packageName}@${version}`, '--tag', npmTag],
        }),
        fatal: false,
      },
      ...(first && options.branch !== undefined
        ? [
            {
              kind: 'run',
              label: 'switch to the release branch',
              command: ['git', 'switch', '-c', options.branch],
              fatal: true,
            } as TStep,
          ]
        : []),
      {
        kind: 'run',
        label: `${pkg.name}: clear the relock folder`,
        command: ['rm', '-rf', scratch],
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: make the relock folder`,
        command: ['mkdir', '-p', scratch],
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: copy HEAD to the relock folder`,
        command: ['sh', '-c', 'git archive HEAD | tar -x -C "$1"', 'sh', scratch],
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: copy the bumped manifest`,
        command: ['cp', `${dir}/package.json`, join(scratch, dir, 'package.json')],
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: relock`,
        command: ['bun', 'install', '--lockfile-only'],
        cwd: scratch,
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: copy the lockfile back`,
        command: ['cp', join(scratch, 'bun.lock'), 'bun.lock'],
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: stage the release`,
        command: ['git', 'add', `${dir}/package.json`, 'bun.lock'],
        fatal: true,
      },
      {
        kind: 'run',
        label: `${pkg.name}: commit`,
        command: ['git', 'commit', '-m', subject],
        fatal: true,
        stage: 'committed',
      },
      {
        kind: 'run',
        label: `${pkg.name}: push`,
        command: ['git', 'push', 'origin', 'HEAD:develop'],
        fatal: true,
        stage: 'pushed',
      },
      {
        kind: 'run',
        label: `${pkg.name}: annotate the tag`,
        command: ['git', 'tag', '-a', tag, '-m', `${pkg.packageName} v${version}`],
        fatal: true,
      },
      { kind: 'push-tag', label: `${pkg.name}: push the tag`, tag },
    ];
  }

  /** The whole sequence, as the dry run prints it. */
  static plan(opts: { options: IChainOptions }): { phaseA: TStep[]; phaseB: TStep[] } {
    const { options } = opts;

    return {
      phaseA: options.packages.flatMap((pkg) => ReleaseChain.checks({ pkg, options })),
      phaseB: options.packages.flatMap((pkg, index) =>
        ReleaseChain.release({ pkg, options, first: index === 0 }),
      ),
    };
  }

  static describe(opts: { step: TStep }): string {
    const { step } = opts;
    if ('command' in step) {
      return `${step.label}: ${step.command.join(' ')}${step.kind === 'run' && step.cwd ? `  (in ${step.cwd})` : ''}`;
    }

    return step.label;
  }

  /** What the operator reads when a run stops: the package, the step, who is done, and the repair. */
  static report(opts: {
    states: readonly IPackageState[];
    failed: IPackageState;
    label: string;
    version: string;
    detail?: string;
  }): string {
    const { states, failed, label, version, detail } = opts;
    const done = states
      .filter((state) => state.stage === 'tagged' || state.skipped)
      .map((s) => s.name);
    const lines = [
      `The run stopped at "${label}"${detail ? `: ${detail}` : ''}.`,
      `Done: ${done.length > 0 ? done.join(', ') : 'none'}. Stopped in: ${failed.name} (${failed.packageName}@${version}).`,
    ];
    const name = failed.packageName;
    const tag = `${failed.name}-v${version}`;

    switch (failed.stage) {
      case 'none': {
        lines.push(
          'Nothing of this package was published; fix the cause and dispatch again with --version to continue.',
        );
        break;
      }
      case 'attempted': {
        lines.push(
          `A publish of ${name}@${version} was attempted and its outcome is unknown (a lost response still leaves npm holding the version).`,
          `Confirm first:  npm view ${name} versions`,
          'If it is live, bump the manifest by hand so the next dispatch does not retry it; if it is not live, dispatch again.',
        );
        break;
      }
      case 'published': {
        lines.push(
          `${name}@${version} is published but not committed. Confirm: npm view ${name} versions`,
          `Bump the manifest by hand:  cd packages/${failed.name} && npm version ${version} --no-git-tag-version --workspaces-update=false`,
        );
        break;
      }
      case 'committed': {
        lines.push(
          `${name}@${version} is published and committed locally, but the push to develop did not land (the chain never rebases).`,
          'Pull develop, then push the release commit by hand, then create the tag.',
        );
        break;
      }
      default: {
        lines.push(
          `${name}@${version} is published and develop is updated; only the tag is missing. Create it by hand:`,
          `  git tag -a ${tag} -m "${name} v${version}" && git push origin ${tag}`,
        );
      }
    }

    return lines.join('\n');
  }
}

const atLeast = (opts: { stage: TStage; than: TStage }): boolean =>
  STAGES.indexOf(opts.stage) >= STAGES.indexOf(opts.than);

/**
 * Runs the chain. Returns instead of throwing on a stop, so the caller prints the report and exits; a
 * throw would hide the state of the packages already done.
 */
export const runChain = async (opts: {
  options: IChainOptions;
  ports: IChainPorts;
}): Promise<IChainResult> => {
  const { options, ports } = opts;
  const { version } = options;
  const states: IPackageState[] = options.packages.map((pkg) => ({
    name: pkg.name,
    packageName: pkg.packageName,
    stage: 'none',
    skipped: false,
    warnings: [],
  }));
  const stateOf = (name: string): IPackageState =>
    states.find((state) => state.name === name) as IPackageState;

  const persist = async (): Promise<void> => {
    if (options.statePath !== undefined) {
      await ports.writeFile({
        path: options.statePath,
        content: `${JSON.stringify({ version, states }, null, 2)}\n`,
      });
    }
  };

  const stop = (stopOpts: {
    failed: IPackageState;
    label: string;
    detail?: string;
  }): IChainResult => {
    const report = ReleaseChain.report({ states, version, ...stopOpts });
    ports.log(report);
    return { ok: false, states, report };
  };

  // What each package already is, read fresh before anything changes (D5).
  const toRelease: IChainPackage[] = [];
  for (const pkg of options.packages) {
    const state = stateOf(pkg.name);
    const manifest = ports.readManifest({ path: `packages/${pkg.name}/package.json` });
    const order = Bun.semver.order(manifest.version, version);
    const onNpm = await ports.hasVersion({ packageName: pkg.packageName, version });

    if (order > 0) {
      return stop({
        failed: state,
        label: 'plan',
        detail: `${pkg.packageName} is at ${manifest.version}, above ${version}`,
      });
    }

    if (order === 0) {
      const tagged = await ports.tagOnOrigin({ tag: `${pkg.name}-v${version}` });
      if (onNpm && tagged) {
        state.skipped = true;
        state.stage = 'tagged';
        ports.log(`${pkg.name}: ${version} is released and tagged - skipped`);
        continue;
      }

      state.stage = onNpm ? 'pushed' : 'none';
      return stop({
        failed: state,
        label: 'plan',
        detail: onNpm
          ? `the manifest is at ${version}, the version is on npm and the tag is missing`
          : `the manifest is at ${version} but the version is not on npm (a bump without a publish)`,
      });
    }

    if (onNpm) {
      state.stage = 'published';
      return stop({
        failed: state,
        label: 'plan',
        detail: `${pkg.packageName}@${version} is on npm but the manifest is at ${manifest.version}`,
      });
    }

    toRelease.push({ name: pkg.name, packageName: manifest.name });
  }

  const planned = {
    ...options,
    packages: toRelease,
    chainReleased: options.chainReleased ?? toRelease.map((p) => p.packageName),
  };

  const execute = async (
    step: TStep,
    state: IPackageState | undefined,
  ): Promise<{ ok: boolean; detail?: string }> => {
    ports.log(`>>> ${ReleaseChain.describe({ step })}`);

    switch (step.kind) {
      case 'run': {
        const result = await ports.run({ command: step.command, cwd: step.cwd });
        if (result.exitCode !== 0) {
          if (!step.fatal && state) {
            state.warnings.push(`${step.label} failed (exit ${result.exitCode}); not fatal`);
            return { ok: true };
          }
          return { ok: false, detail: `exit ${result.exitCode}` };
        }
        if (step.stage && state) {
          state.stage = step.stage;
        }
        return { ok: true };
      }
      case 'manifest': {
        const extracted = await ports.run({
          command: ['tar', '-xzOf', step.tarball, 'package/package.json'],
        });
        if (extracted.exitCode !== 0) {
          return { ok: false, detail: 'the tarball has no package.json' };
        }
        await ports.writeFile({ path: step.out, content: extracted.stdout });
        const checked = await ports.run({
          command: ReleaseChain.gate({ args: ['protocols', step.out] }),
        });
        if (checked.exitCode !== 0) {
          return { ok: false, detail: 'an unresolved protocol survives in the packed manifest' };
        }
        const packed = JSON.parse(extracted.stdout) as { version?: string };
        if (packed.version !== version) {
          return {
            ok: false,
            detail: `the tarball is ${packed.version}, this run releases ${version}`,
          };
        }
        return { ok: true };
      }
      case 'record-sha': {
        if (state) {
          state.sha = await ports.sha256({ path: step.tarball });
        }
        return { ok: true };
      }
      case 'verify-sha': {
        const now = await ports.sha256({ path: step.tarball });
        return now === state?.sha
          ? { ok: true }
          : { ok: false, detail: 'the tarball changed after it was checked' };
      }
      case 'publish': {
        if (state) {
          state.stage = 'attempted';
        }
        const result = await ports.run({ command: step.command, cwd: step.cwd });
        if (result.exitCode !== 0) {
          return { ok: false, detail: `exit ${result.exitCode}` };
        }
        if (state) {
          state.stage = 'published';
        }
        return { ok: true };
      }
      case 'wait': {
        if (!state) {
          return { ok: false, detail: 'no package' };
        }
        try {
          await ports.waitForTarball({ packageName: state.packageName, version });
        } catch (error) {
          return { ok: false, detail: error instanceof Error ? error.message : String(error) };
        }
        return { ok: true };
      }
      case 'push-tag': {
        for (let attempt = 1; attempt <= ReleaseChain.PUSH_ATTEMPTS; attempt += 1) {
          const result = await ports.run({ command: ['git', 'push', 'origin', step.tag] });
          if (result.exitCode === 0) {
            if (state) {
              state.stage = 'tagged';
            }
            return { ok: true };
          }
          ports.log(`>>> tag push attempt ${attempt} failed`);
          if (attempt < ReleaseChain.PUSH_ATTEMPTS) {
            await ports.sleep(attempt * 10_000);
          }
        }
        return { ok: false, detail: 'the tag push failed three times' };
      }
      default: {
        return { ok: false, detail: 'unknown step' };
      }
    }
  };

  // Phase A: before the first publish, for every package that will be released.
  for (const pkg of toRelease) {
    for (const step of ReleaseChain.checks({ pkg, options: planned })) {
      const outcome = await execute(step, undefined);
      await persist();
      if (!outcome.ok) {
        return stop({ failed: stateOf(pkg.name), label: step.label, detail: outcome.detail });
      }
    }
  }

  // Phase B: one package at a time.
  for (const [index, pkg] of toRelease.entries()) {
    const state = stateOf(pkg.name);
    for (const step of ReleaseChain.release({ pkg, options: planned, first: index === 0 })) {
      const outcome = await execute(step, state);
      await persist();
      if (!outcome.ok) {
        return stop({ failed: state, label: step.label, detail: outcome.detail });
      }
    }
    if (atLeast({ stage: state.stage, than: 'tagged' })) {
      ports.log(`${pkg.name}: released ${version}`);
    }
  }

  return { ok: true, states };
};

const readArgs = (opts: { argv: string[] }) => {
  const value = (flag: string): string | undefined => {
    const index = opts.argv.indexOf(flag);
    return index === -1 ? undefined : opts.argv[index + 1];
  };
  const packages = value('--packages');
  const version = value('--version');
  if (!packages || !version) {
    throw new Error(
      '[release-chain] use: --packages kernel,react --version <x.y.z[-pre]> [--issue N] [--branch name] [--tarballs dir] [--tmp dir] [--state file] [--dry-run]',
    );
  }

  return {
    names: packages.split(','),
    version,
    issue: value('--issue'),
    branch: value('--branch'),
    tarballs: resolve(value('--tarballs') ?? '.agents/local/tmp/release-tarballs'),
    tmp: resolve(value('--tmp') ?? process.env.RUNNER_TEMP ?? '.agents/local/tmp'),
    state: value('--state'),
    dryRun: opts.argv.includes('--dry-run'),
  };
};

const realPorts = (): IChainPorts => ({
  run: async ({ command, cwd }) => {
    const proc = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'inherit' });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (!command.includes('-xzOf')) {
      process.stdout.write(stdout);
    }
    return { exitCode, stdout };
  },
  readManifest: ({ path }) =>
    JSON.parse(readFileSync(path, 'utf8')) as { name: string; version: string },
  hasVersion: async ({ packageName, version }) => {
    const proc = Bun.spawnSync(
      ['npm', 'view', `${packageName}@${version}`, 'version', '--prefer-online'],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    return proc.exitCode === 0 && proc.stdout.toString().trim().length > 0;
  },
  tagOnOrigin: async ({ tag }) => {
    const proc = Bun.spawnSync(['git', 'ls-remote', '--tags', 'origin', `refs/tags/${tag}`], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    return proc.exitCode === 0 && proc.stdout.toString().trim().length > 0;
  },
  waitForTarball: (waitOpts) => waitForTarball(waitOpts),
  sha256: async ({ path }) =>
    new Bun.CryptoHasher('sha256').update(await Bun.file(path).bytes()).digest('hex'),
  writeFile: async ({ path, content }) => {
    await Bun.write(path, content);
  },
  sleep: (ms) => new Promise<void>((done) => setTimeout(done, ms)),
  log: (line) => console.log(line),
});

const main = async (): Promise<void> => {
  const args = readArgs({ argv: Bun.argv.slice(2) });
  const ports = realPorts();
  const packages: IChainPackage[] = args.names.map((name) => ({
    name,
    packageName: ports.readManifest({ path: `packages/${name}/package.json` }).name,
  }));
  const options: IChainOptions = {
    packages,
    version: args.version,
    npmTag: npmTagFor({ target: args.version }),
    issue: args.issue,
    branch: args.branch,
    tarballs: args.tarballs,
    tmp: args.tmp,
    statePath: args.state,
    chainReleased: packages.map((pkg) => pkg.packageName),
  };

  if (args.dryRun) {
    const { phaseA, phaseB } = ReleaseChain.plan({ options });
    console.log('Phase A: the checks before the first publish');
    for (const step of phaseA) console.log(`  ${ReleaseChain.describe({ step })}`);
    console.log('Phase B: one package at a time');
    for (const step of phaseB) console.log(`  ${ReleaseChain.describe({ step })}`);
    return;
  }

  const result = await runChain({ options, ports });
  if (!result.ok) {
    process.exit(1);
  }
};

if (import.meta.main) {
  await main();
}
