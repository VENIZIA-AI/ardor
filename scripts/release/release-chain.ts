/**
 * Releases the planned packages in dependency order, in one run.
 *
 * The workflow calls this file in one step. The steps of a package are data (`ReleaseChain.plan`), so
 * a test reads the exact command sequence; `runChain` executes them through injected ports (a command
 * runner, the registry, git, the clock), so a test can fail any step and see what is left behind.
 *
 *   bun scripts/release/release-chain.ts --packages kernel,react,admin,ardor --version 0.4.6-0
 *       [--issue N] [--branch release-123] [--tarballs <dir>] [--tmp <dir>] [--state <file>] [--dry-run]
 *       [--target-branch develop|main] [--plan-version <v> --plan-kind prerelease|stable]
 *   bun scripts/release/release-chain.ts report --state <file>
 *
 * `report` prints the report of a run from its state file and appends it to `$GITHUB_STEP_SUMMARY`; the
 * workflow runs it in a final `if: always()` step, because a job that was cancelled or timed out runs
 * no script of its own.
 *
 * Phase A checks every package that will be released, before the first publish: links, build,
 * artifacts, pack, protocols and registry. Phase P prepares them all and publishes nothing: for each package the
 * bump, the preset (ardor), the tarball that is published, the check of its manifest and of its exact pins on its
 * siblings, and its sha256; then one clean-install gate over the tarballs of the whole run, whose siblings are the
 * local tarballs, not the registry. Phase B publishes the packages one after another, in order, with no wait: a
 * package only needs its sibling accepted by npm, not yet served. Phase R then records each published package: it
 * waits for its tarball to answer 200 (the first wait covers the lag of all of them), moves the dist-tags, and makes
 * the release commit, the push and the tag, so a tag still means installable. A stop in phase P publishes nothing; a
 * stop in phase B still records what was published, so git keeps up with npm as far as it can. The same version
 * dispatched again heals what is missing: a package on npm without its commit gets the commit and the tag without a
 * second publish, one with a commit and no tag gets the tag, one released and tagged is skipped.
 *
 * A stable (a version without a prerelease part) runs from `main`: the release commits are pushed to
 * `main` and, after the last package is tagged, one run-level step merges `main` back into `develop` in
 * a clean worktree of `origin/develop` with a copy of `merge-back.ts` from this checkout. The step is
 * skipped when `develop` already holds the last release commit, and it runs alone when every package is
 * already released (a re-dispatch of a run that stopped after its last tag). A prerelease runs from
 * `develop` and has no merge back. The version, the kind and the branch must agree with each other and
 * with the plan the workflow made (`--plan-version`, `--plan-kind`), or the run stops before it builds.
 *
 * The publish is the one step that cannot be undone, so it runs before every git write of its package,
 * and the "a publish was attempted" state is recorded BEFORE the call (a lost response still leaves npm
 * holding the version). A rejected push stops the run: the chain never rebases, because a rebase would
 * pull commits the tests never saw into the tree that later packages are built and published from.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { npmTagFor } from './release-version';
import { waitForTarball } from './release-wait';

/** How far a package got. A report is built from the last stage it reached. */
type TStage = 'none' | 'attempted' | 'published' | 'committed' | 'pushed' | 'tagged';

const STAGES: readonly TStage[] = [
  'none',
  'attempted',
  'published',
  'committed',
  'pushed',
  'tagged',
];

export type TChainKind = 'prerelease' | 'stable';

/**
 * What a package needs from this run. `full`: bump, pack, publish, record. `record`: an earlier dispatch published it
 * but its release commit is missing, so it is bumped again and recorded without a second publish. `tag`: released and
 * committed, only the tag is missing.
 */
export type TPackageMode = 'full' | 'record' | 'tag';

export type TStep =
  | { kind: 'run'; label: string; command: string[]; cwd?: string; fatal: boolean; stage?: TStage }
  | { kind: 'manifest'; label: string; tarball: string; out: string }
  | { kind: 'record-sha'; label: string; tarball: string }
  | { kind: 'verify-sha'; label: string; tarball: string }
  | { kind: 'publish'; label: string; command: string[]; cwd?: string }
  | { kind: 'wait'; label: string }
  | { kind: 'tag-release-commit'; label: string; tag: string; message: string; grep: string }
  | { kind: 'push-tag'; label: string; tag: string }
  | { kind: 'merge-back'; label: string };

export interface IChainPackage {
  /** The workspace folder name: kernel, react, admin, ardor. */
  name: string;
  /** The npm name, from the manifest. */
  packageName: string;
  /** What this run does for the package; `full` when absent. */
  mode?: TPackageMode;
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
  /** What the version is: a stable runs from `main` and ends with the merge back. Derived from the version when absent. */
  kind?: TChainKind;
  /** The branch the release commits are pushed to. `main` for a stable, `develop` for a prerelease, when absent. */
  targetBranch?: string;
  /** What the plan job decided; the run stops before it builds when its own version or kind differs. */
  plan?: { version: string; kind: TChainKind };
  /** The `name=version` pairs the tag message records as `built on:` (read from the refreshed catalog). */
  builtOn?: string;
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
  /** The IGNIS versions this build uses, as `name=version, ...`, read after the catalog refresh. */
  readBuiltOn?: () => string;
}

export interface IPackageState {
  name: string;
  packageName: string;
  stage: TStage;
  skipped: boolean;
  sha?: string;
  /** The siblings the packed manifest pins, `name -> version`: what the publish step checks was published first. */
  pins?: Record<string, string>;
  mode?: TPackageMode;
  warnings: string[];
}

/** Why a run stopped: kept in the state file, so a step that runs after the job can print the report. */
export interface IChainStop {
  failed: string;
  label: string;
  detail?: string;
}

/** The state file: what a later step reads when the process that wrote it is gone. */
export interface IChainState {
  version: string;
  states: IPackageState[];
  stopped?: IChainStop;
  /** The branch the release commits go to, for a report that names it. */
  targetBranch?: string;
  /** A stable's merge back: `none` until it is done (or found already done). Absent for a prerelease. */
  mergeBack?: 'none' | 'done';
}

export interface IChainResult {
  ok: boolean;
  states: IPackageState[];
  /** What the operator reads when the run stopped. */
  report?: string;
}

export class ReleaseChain {
  static readonly PUSH_ATTEMPTS = 3;

  /** The workspace folders that make up the release, in dependency order. */
  static readonly WORKSPACE = ['kernel', 'react', 'admin', 'ardor'] as const;

  /** The branch the merge back goes into. */
  static readonly DEVELOP = 'develop';

  static gate(opts: { args: string[] }): string[] {
    return ['bun', 'scripts/release/release-gates.ts', ...opts.args];
  }

  /**
   * The `built on:` pairs of a tag: each IGNIS package of the catalog and the version it resolved to. The
   * refreshed catalog holds ranges (`^0.4.6-0`); the line holds the version, which the stable gate compares.
   */
  static builtOnOf(opts: { catalog: Record<string, string> }): string {
    return Object.entries(opts.catalog)
      .filter(([name]) => name.startsWith('@venizia/'))
      .map(([name, range]) => `${name}=${range.replace(/^[\^~]/, '')}`)
      .join(', ');
  }

  /** A version with a prerelease part is a prerelease, anything else a stable. */
  static kindOf(opts: { options: Pick<IChainOptions, 'version' | 'kind'> }): TChainKind {
    return opts.options.kind ?? (opts.options.version.includes('-') ? 'prerelease' : 'stable');
  }

  static targetBranchOf(opts: {
    options: Pick<IChainOptions, 'version' | 'kind' | 'targetBranch'>;
  }): string {
    return (
      opts.options.targetBranch ??
      (ReleaseChain.kindOf({ options: opts.options }) === 'stable' ? 'main' : ReleaseChain.DEVELOP)
    );
  }

  /** Why the run may not start: the version, the kind and the branch must agree, and with the plan. */
  static checkBinding(opts: { options: IChainOptions }): string[] {
    const { options } = opts;
    const problems: string[] = [];
    const given = ReleaseChain.kindOf({ options });
    const fromVersion = options.version.includes('-') ? 'prerelease' : 'stable';
    const branch = ReleaseChain.targetBranchOf({ options });

    if (given !== fromVersion) {
      problems.push(`the kind is ${given} but ${options.version} is a ${fromVersion}`);
    }

    if (branch !== (fromVersion === 'stable' ? 'main' : ReleaseChain.DEVELOP)) {
      problems.push(
        `a ${fromVersion} (${options.version}) is released from ${fromVersion === 'stable' ? 'main' : ReleaseChain.DEVELOP}, not ${branch}`,
      );
    }

    if (options.plan !== undefined) {
      if (options.plan.version !== options.version) {
        problems.push(
          `the plan approved ${options.plan.version} but this run would publish ${options.version}`,
        );
      }
      if (options.plan.kind !== given) {
        problems.push(`the plan said ${options.plan.kind} but this run is a ${given}`);
      }
    }

    return problems;
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
      ...(ReleaseChain.kindOf({ options }) === 'stable'
        ? [
            {
              kind: 'run',
              label: `${pkg.name}: stable-deps`,
              command: ReleaseChain.gate({ args: ['stable-deps', packed] }),
              fatal: true,
            } as TStep,
          ]
        : []),
      {
        kind: 'run',
        label: `${pkg.name}: registry`,
        command: ReleaseChain.gate({ args: ['registry', packed, '--chain-released', released] }),
        fatal: true,
      },
    ];
  }

  /**
   * Phase P for one package: everything up to a packed, checked tarball, and nothing that cannot be undone. A
   * package an earlier dispatch already published (`record`) is only bumped, so the release commit holds its version.
   */
  static prepare(opts: { pkg: IChainPackage; options: IChainOptions; first: boolean }): TStep[] {
    const { pkg, options, first } = opts;
    const { version, tarballs, tmp } = options;
    const dir = `packages/${pkg.name}`;
    const tarball = join(tarballs, `${pkg.name}.tgz`);
    const isStable = ReleaseChain.kindOf({ options }) === 'stable';
    const bump: TStep = {
      kind: 'run',
      label: `${pkg.name}: bump`,
      command: ['npm', 'version', version, '--no-git-tag-version', '--workspaces-update=false'],
      cwd: dir,
      fatal: true,
    };

    if (pkg.mode === 'tag') {
      return [];
    }

    if (pkg.mode === 'record') {
      return [bump];
    }

    return [
      // `bun pm pack --filename` does not create the folder it writes to.
      ...(first
        ? [
            {
              kind: 'run',
              label: 'make the tarball folder',
              command: ['mkdir', '-p', tarballs],
              fatal: true,
            } as TStep,
          ]
        : []),
      bump,
      ...(pkg.name === 'ardor'
        ? [
            {
              kind: 'run',
              label: 'ardor: write the VULCAN preset',
              command: ['bun', 'scripts/preset/vulcan-preset.ts'],
              fatal: true,
            } as TStep,
            ...(isStable
              ? [
                  {
                    kind: 'run',
                    label: 'ardor: check the preset names only stable versions',
                    command: ReleaseChain.gate({
                      args: ['stable-deps', 'packages/ardor/dist/presets'],
                    }),
                    fatal: true,
                  } as TStep,
                ]
              : []),
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
    ];
  }

  /**
   * The one clean-install gate of the run, after every package is bumped and packed and before the first publish. It
   * packs the named packages again from the tree and installs them with the others as local tarballs, so no sibling
   * is read from the registry and nothing has to be served yet.
   */
  static install(opts: { names: readonly string[] }): TStep[] {
    return opts.names.length === 0
      ? []
      : [
          {
            kind: 'run',
            label: `clean-install: ${opts.names.join(', ')} from their own tarballs`,
            command: ['bun', 'scripts/checks/clean-install/cli.ts', ...opts.names],
            fatal: true,
          },
        ];
  }

  /** Phase B for one package: the sha of the tarball is what was checked, then the publish. No wait. */
  static publish(opts: { pkg: IChainPackage; options: IChainOptions }): TStep[] {
    const { pkg, options } = opts;
    const { npmTag, tarballs } = options;
    const tarball = join(tarballs, `${pkg.name}.tgz`);

    return [
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
    ];
  }

  /**
   * Phase R for one published package: the wait for its tarball, the dist-tags, then the release commit, the push and
   * the tag. A package that only lacks its tag (`tag`) gets the wait and the tag on the release commit that is in the
   * history.
   */
  static record(opts: { pkg: IChainPackage; options: IChainOptions; first: boolean }): TStep[] {
    const { pkg, options, first } = opts;
    const { version, npmTag, tmp } = options;
    const dir = `packages/${pkg.name}`;
    const tag = `${pkg.name}-v${version}`;
    const targetBranch = ReleaseChain.targetBranchOf({ options });
    const tagMessage = `${pkg.packageName} v${version}${options.builtOn ? `\nbuilt on: ${options.builtOn}` : ''}`;
    const scratch = join(tmp, `relock-${pkg.name}`);
    const subject = `${options.issue === undefined ? '' : `[#${options.issue}] `}chore(${pkg.name}): release v${version} [${version}]`;
    const wait: TStep = { kind: 'wait', label: `${pkg.name}: wait for the tarball to answer 200` };

    if (pkg.mode === 'tag') {
      return [
        wait,
        {
          kind: 'tag-release-commit',
          label: `${pkg.name}: annotate the tag on the release commit`,
          tag,
          message: tagMessage,
          grep: `chore(${pkg.name}): release v${version} `,
        },
        { kind: 'push-tag', label: `${pkg.name}: push the tag`, tag },
      ];
    }

    return [
      wait,
      {
        kind: 'run',
        label: `${pkg.name}: tag highest`,
        command: ReleaseChain.gate({
          args: ['tag-highest', '--published', `${pkg.packageName}@${version}`],
        }),
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
        command: ['git', 'push', 'origin', `HEAD:${targetBranch}`],
        fatal: true,
        stage: 'pushed',
      },
      {
        kind: 'run',
        label: `${pkg.name}: annotate the tag`,
        command: ['git', 'tag', '-a', tag, '-m', tagMessage],
        fatal: true,
      },
      { kind: 'push-tag', label: `${pkg.name}: push the tag`, tag },
    ];
  }

  /** The whole sequence, as the dry run prints it. */
  static plan(opts: { options: IChainOptions }): {
    phaseA: TStep[];
    phaseP: TStep[];
    phaseB: TStep[];
    phaseR: TStep[];
    phaseC: TStep[];
  } {
    const { options } = opts;
    const packages = options.packages.map((pkg) => ({ ...pkg, mode: pkg.mode ?? 'full' }));

    return {
      phaseA: packages.flatMap((pkg) => ReleaseChain.checks({ pkg, options })),
      phaseP: [
        ...packages.flatMap((pkg, index) =>
          ReleaseChain.prepare({ pkg, options, first: index === 0 }),
        ),
        ...ReleaseChain.install({
          names: packages.filter((pkg) => pkg.mode === 'full').map((pkg) => pkg.name),
        }),
      ],
      phaseB: packages
        .filter((pkg) => pkg.mode === 'full')
        .flatMap((pkg) => ReleaseChain.publish({ pkg, options })),
      phaseR: packages.flatMap((pkg, index) =>
        ReleaseChain.record({ pkg, options, first: index === 0 }),
      ),
      phaseC: ReleaseChain.mergeBack({ options }),
    };
  }

  /** Phase C: after the last package, a stable merges `main` back into `develop`. A prerelease has none. */
  static mergeBack(opts: { options: IChainOptions }): TStep[] {
    return ReleaseChain.kindOf({ options: opts.options }) === 'stable'
      ? [{ kind: 'merge-back', label: 'merge back: main into develop' }]
      : [];
  }

  /**
   * The commands of the merge back, in order. `apply` is a copy of this checkout's `merge-back.ts`, run on a
   * clean worktree of `origin/develop`, so no file of `develop` configures the publishing job.
   */
  static mergeBackCommands(opts: { options: IChainOptions; head: string }): {
    contained: string[];
    fetch: string[];
    add: string[];
    copy: string[];
    apply: string[];
    push: string[];
    remove: string[];
    worktree: string;
  } {
    const { options, head } = opts;
    const worktree = join(options.tmp, 'merge-back-develop');
    const script = join(options.tmp, 'merge-back-main.ts');
    const prefix = options.issue === undefined ? '' : `[#${options.issue}] `;
    const message = `${prefix}chore(release): merge ${ReleaseChain.targetBranchOf({ options })} into develop after v${options.version}`;

    return {
      fetch: ['git', 'fetch', 'origin', ReleaseChain.DEVELOP],
      contained: ['git', 'merge-base', '--is-ancestor', head, `origin/${ReleaseChain.DEVELOP}`],
      add: ['git', 'worktree', 'add', '--detach', worktree, `origin/${ReleaseChain.DEVELOP}`],
      copy: ['cp', 'scripts/release/merge-back.ts', script],
      apply: ['bun', script, 'apply', '--from', head, '--repo', worktree, '--message', message],
      push: ['git', 'push', 'origin', `HEAD:${ReleaseChain.DEVELOP}`],
      remove: ['git', 'worktree', 'remove', worktree],
      worktree,
    };
  }

  /**
   * Every package is out and tagged, and only the merge back of the stable is missing: the report says so
   * and gives the repair.
   */
  static mergeBackReport(opts: {
    states: readonly IPackageState[];
    version: string;
    label: string;
    detail?: string;
    targetBranch: string;
  }): string {
    const { states, version, label, detail, targetBranch } = opts;
    const done = states.map((state) => state.name).join(', ');

    return [
      'Report - published, merge back not done.',
      `The run stopped at "${label}"${detail ? `: ${detail}` : ''}.`,
      `Every package is released and tagged on ${targetBranch} at ${version} (${done}). Only the merge back of ${targetBranch} into ${ReleaseChain.DEVELOP} is missing.`,
      'Dispatch the same version again: only the merge back runs. Or by hand:',
      `  git fetch origin && git switch ${ReleaseChain.DEVELOP} && git pull --ff-only origin ${ReleaseChain.DEVELOP}`,
      `  git merge --no-ff origin/${targetBranch}   (keep the greater version in each package.json, regenerate bun.lock)`,
      `  git push origin ${ReleaseChain.DEVELOP}`,
    ].join('\n');
  }

  static describe(opts: { step: TStep }): string {
    const { step } = opts;
    if ('command' in step) {
      return `${step.label}: ${step.command.join(' ')}${step.kind === 'run' && step.cwd ? `  (in ${step.cwd})` : ''}`;
    }

    return step.label;
  }

  /**
   * The report of a run read back from its state file. A run that stopped on its own carries the step; a
   * job that was cancelled or timed out does not, so the package left half done is named instead.
   */
  static reportFromState(opts: { state: IChainState }): string {
    const { state } = opts;
    const { version, states, stopped } = state;
    const targetBranch = state.targetBranch ?? ReleaseChain.DEVELOP;

    const allTagged = states.every((candidate) => candidate.stage === 'tagged');

    if (
      stopped?.failed === 'merge back' ||
      (state.mergeBack === 'none' && stopped === undefined && allTagged)
    ) {
      return ReleaseChain.mergeBackReport({
        states,
        version,
        label: stopped?.label ?? 'the job ended before the merge back finished',
        detail: stopped?.detail,
        targetBranch,
      });
    }

    const named = stopped && states.find((candidate) => candidate.name === stopped.failed);
    const halfDone = states.find(
      (candidate) => candidate.stage !== 'none' && candidate.stage !== 'tagged',
    );
    const failed = named ?? halfDone;

    if (failed === undefined) {
      const done = states.filter((candidate) => candidate.stage === 'tagged');
      return stopped
        ? ReleaseChain.report({
            states,
            failed: states[0] as IPackageState,
            label: stopped.label,
            version,
            detail: stopped.detail,
            targetBranch,
          })
        : `No package was left half done (${done.length} of ${states.length} released at ${version}).`;
    }

    return ReleaseChain.report({
      states,
      failed,
      label: stopped?.label ?? 'the job ended before the run finished',
      version,
      detail: stopped?.detail,
      targetBranch,
    });
  }

  /** What the operator reads when a run stops: the package, the step, who is done, and the repair. */
  static report(opts: {
    states: readonly IPackageState[];
    failed: IPackageState;
    label: string;
    version: string;
    detail?: string;
    /** The branch the release commits go to; `develop` when absent. */
    targetBranch?: string;
  }): string {
    const { states, failed, label, version, detail } = opts;
    const target = opts.targetBranch ?? ReleaseChain.DEVELOP;
    const done = states
      .filter((state) => state.stage === 'tagged' || state.skipped)
      .map((s) => s.name);
    const lines = [
      `The run stopped at "${label}"${detail ? `: ${detail}` : ''}.`,
      `Done: ${done.length > 0 ? done.join(', ') : 'none'}. Stopped in: ${failed.name} (${failed.packageName}@${version}).`,
    ];
    const name = failed.packageName;
    const tag = `${failed.name}-v${version}`;
    const waiting = states.filter(
      (state) =>
        state !== failed &&
        !state.skipped &&
        state.stage !== 'none' &&
        state.stage !== 'attempted' &&
        state.stage !== 'tagged',
    );

    if (waiting.length > 0) {
      lines.push(
        `Published and not yet recorded in git: ${waiting.map((state) => state.name).join(', ')}.`,
        'Dispatch the same version again: the run records them (release commit, push, tag) without a second publish.',
      );
    }

    switch (failed.stage) {
      case 'none': {
        lines.push(
          'Nothing of this package was published; fix the cause and dispatch the same version again to continue.',
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
          'Dispatch the same version again: the run bumps it and records it without publishing it twice. Or by hand:',
          `  cd packages/${failed.name} && npm version ${version} --no-git-tag-version --workspaces-update=false`,
        );
        break;
      }
      case 'committed': {
        lines.push(
          `${name}@${version} is published and committed locally, but the push to ${target} did not land (the chain never rebases).`,
          'Dispatch the same version again: the run records it without publishing it twice. Or by hand:',
          `Pull ${target}, then push the release commit by hand, then create the tag.`,
        );
        break;
      }
      default: {
        lines.push(
          `${name}@${version} is published and ${target} is updated; only the tag is missing. Dispatch the same version again: the run writes the tag. Or by hand:`,
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
    mode: 'full',
    warnings: [],
  }));
  const stateOf = (name: string): IPackageState =>
    states.find((state) => state.name === name) as IPackageState;

  const isStable = ReleaseChain.kindOf({ options }) === 'stable';
  const targetBranch = ReleaseChain.targetBranchOf({ options });
  /** The npm name of each workspace folder: what a pin in a packed manifest is matched against. */
  const workspaceNames = new Map<string, string>();
  for (const dir of ReleaseChain.WORKSPACE) {
    try {
      workspaceNames.set(dir, ports.readManifest({ path: `packages/${dir}/package.json` }).name);
    } catch {
      // A folder that is not there is not a sibling.
    }
  }
  let stopped: IChainStop | undefined;
  let mergeBack: 'none' | 'done' = 'none';

  const persist = async (): Promise<void> => {
    if (options.statePath !== undefined) {
      const state: IChainState = {
        version,
        states,
        targetBranch,
        ...(isStable ? { mergeBack } : {}),
        ...(stopped ? { stopped } : {}),
      };
      await ports.writeFile({
        path: options.statePath,
        content: `${JSON.stringify(state, null, 2)}\n`,
      });
    }
  };

  const stop = async (stopOpts: {
    failed: IPackageState;
    label: string;
    detail?: string;
  }): Promise<IChainResult> => {
    const report = ReleaseChain.report({ states, version, targetBranch, ...stopOpts });
    stopped = { failed: stopOpts.failed.name, label: stopOpts.label, detail: stopOpts.detail };
    await persist();
    ports.log(report);
    return { ok: false, states, report };
  };

  const unbound = ReleaseChain.checkBinding({ options });
  if (unbound.length > 0) {
    return stop({ failed: states[0] as IPackageState, label: 'plan', detail: unbound.join('; ') });
  }

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

      if (onNpm) {
        // Released and committed by an earlier dispatch: only the tag is missing.
        state.mode = 'tag';
        state.stage = 'pushed';
        ports.log(`${pkg.name}: ${version} is on npm without its tag - writing the tag`);
        toRelease.push({ name: pkg.name, packageName: manifest.name, mode: 'tag' });
        continue;
      }

      state.stage = 'none';
      return stop({
        failed: state,
        label: 'plan',
        detail: `the manifest is at ${version} but the version is not on npm (a bump without a publish)`,
      });
    }

    if (onNpm) {
      // Published by an earlier dispatch whose release commit never landed: record it, never publish it twice.
      state.mode = 'record';
      state.stage = 'published';
      ports.log(
        `${pkg.name}: ${version} is on npm without its release commit - recording it without publishing`,
      );
      toRelease.push({ name: pkg.name, packageName: manifest.name, mode: 'record' });
      continue;
    }

    toRelease.push({ name: pkg.name, packageName: manifest.name, mode: 'full' });
  }

  const planned = {
    ...options,
    builtOn: options.builtOn ?? ports.readBuiltOn?.(),
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
        const packed = JSON.parse(extracted.stdout) as {
          version?: string;
          dependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
        };
        if (packed.version !== version) {
          return {
            ok: false,
            detail: `the tarball is ${packed.version}, this run releases ${version}`,
          };
        }

        // bun writes the exact version of every workspace sibling into the tarball: a different pin means the pack did
        // not see this run's bump, and a pin on a package released after this one is an order bug.
        const problems: string[] = [];
        const pins: Record<string, string> = {};
        for (const [name, pinned] of Object.entries({
          ...packed.dependencies,
          ...packed.peerDependencies,
        })) {
          const sibling = ReleaseChain.WORKSPACE.find((dir) => workspaceNames.get(dir) === name);
          if (sibling === undefined || sibling === state?.name) {
            continue;
          }

          const expected = ports.readManifest({ path: `packages/${sibling}/package.json` }).version;
          if (pinned !== expected) {
            problems.push(`${name} is pinned ${pinned}, the workspace has ${expected}`);
          }
          const later = toRelease.findIndex((candidate) => candidate.name === sibling);
          const own = toRelease.findIndex((candidate) => candidate.name === state?.name);
          if (later > own && own > -1) {
            problems.push(`${name} is released after this package, but this package depends on it`);
          }
          pins[name] = pinned;
        }
        if (problems.length > 0) {
          return { ok: false, detail: problems.join('; ') };
        }
        if (state) {
          state.pins = pins;
        }
        return { ok: true };
      }
      case 'record-sha': {
        if (state) {
          const result2 = await ports.sha256({ path: step.tarball });
          state.sha = result2;
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
        // Every sibling this package ships against is on npm: one this run published before it (npm accepted it, the
        // registry serves it minutes later, which is why there is no wait here), or one outside the plan.
        for (const [name, pinned] of Object.entries(state?.pins ?? {})) {
          const inRun = states.find((candidate) => candidate.packageName === name);
          const isOut = inRun !== undefined && atLeast({ stage: inRun.stage, than: 'published' });
          if (
            inRun === undefined
              ? !(await ports.hasVersion({ packageName: name, version: pinned }))
              : !isOut
          ) {
            return { ok: false, detail: `${name}@${pinned} is not on npm` };
          }
        }
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
      case 'tag-release-commit': {
        const found = await ports.run({
          command: ['git', 'log', '-1', '--format=%H', '--fixed-strings', '--grep', step.grep],
        });
        const sha = found.stdout.trim();
        if (found.exitCode !== 0 || sha === '') {
          return { ok: false, detail: `no release commit ${step.grep.trim()} in the history` };
        }
        const tagged = await ports.run({
          command: ['git', 'tag', '-a', step.tag, '-m', step.message, sha],
        });
        return tagged.exitCode === 0
          ? { ok: true }
          : { ok: false, detail: `exit ${tagged.exitCode}` };
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
      case 'merge-back': {
        const result3 = await ports.run({ command: ['git', 'rev-parse', 'HEAD'] });
        const head = result3.stdout.trim();
        const commands = ReleaseChain.mergeBackCommands({ options: planned, head });
        const fetched = await ports.run({ command: commands.fetch });
        if (fetched.exitCode !== 0) {
          return {
            ok: false,
            detail: `could not fetch ${ReleaseChain.DEVELOP} (exit ${fetched.exitCode})`,
          };
        }

        // 0: develop already holds the last release commit; 1: it does not; anything else is an error.
        const contained = await ports.run({ command: commands.contained });
        if (contained.exitCode === 0) {
          ports.log(
            `merge back: ${ReleaseChain.DEVELOP} already holds ${head.slice(0, 7)} - skipped`,
          );
          return { ok: true };
        }
        if (contained.exitCode !== 1) {
          return {
            ok: false,
            detail: `could not compare with ${ReleaseChain.DEVELOP} (exit ${contained.exitCode})`,
          };
        }

        try {
          const sequence: Array<{ command: string[]; cwd?: string; what: string }> = [
            { command: commands.add, what: 'could not make the worktree of develop' },
            { command: commands.copy, what: 'could not copy merge-back.ts' },
            { command: commands.apply, what: 'the merge stops' },
            {
              command: commands.push,
              cwd: commands.worktree,
              what: 'the push to develop was rejected',
            },
          ];

          for (const { command, cwd, what } of sequence) {
            const result = await ports.run({ command, cwd });
            if (result.exitCode !== 0) {
              return { ok: false, detail: `${what} (exit ${result.exitCode})` };
            }
          }
        } finally {
          await ports.run({ command: commands.remove });
        }

        return { ok: true };
      }
      default: {
        return { ok: false, detail: 'unknown step' };
      }
    }
  };

  const full = toRelease.filter((pkg) => pkg.mode === 'full');

  // The packages whose bump has run: a package an earlier dispatch published is recorded only after its bump.
  const prepared = new Set<string>();

  // Records the published packages one after another, in the order they were published: the first failure stops.
  let branchMade = false;
  const recordAll = async (): Promise<
    { failed: IPackageState; label: string; detail?: string } | undefined
  > => {
    for (const pkg of toRelease) {
      const state = stateOf(pkg.name);
      const wants = pkg.mode === 'tag' ? state.stage === 'pushed' : state.stage === 'published';
      if (!wants || (pkg.mode === 'record' && !prepared.has(pkg.name))) {
        continue;
      }

      const first = pkg.mode !== 'tag' && !branchMade;
      for (const step of ReleaseChain.record({ pkg, options: planned, first })) {
        const outcome = await execute(step, state);
        await persist();
        if (!outcome.ok) {
          return { failed: state, label: step.label, detail: outcome.detail };
        }
      }
      if (pkg.mode !== 'tag') {
        branchMade = true;
      }
      if (atLeast({ stage: state.stage, than: 'tagged' })) {
        ports.log(`${pkg.name}: released ${version}`);
      }
    }

    return undefined;
  };

  // A stop before the end still records what was published, so git keeps up with npm as far as it can.
  const stopAfterRecording = async (stopOpts: {
    failed: IPackageState;
    label: string;
    detail?: string;
  }): Promise<IChainResult> => {
    const recorded = await recordAll();
    if (recorded !== undefined) {
      ports.log(
        `WARNING | the packages published before the stop could not all be recorded (${recorded.failed.name}: ${recorded.label}${recorded.detail ? `: ${recorded.detail}` : ''}); dispatch the same version again`,
      );
    }

    return stop(stopOpts);
  };

  // Phase A: before the first publish, for every package that will be released.
  for (const pkg of full) {
    for (const step of ReleaseChain.checks({ pkg, options: planned })) {
      const outcome = await execute(step, undefined);
      await persist();
      if (!outcome.ok) {
        return stopAfterRecording({
          failed: stateOf(pkg.name),
          label: step.label,
          detail: outcome.detail,
        });
      }
    }
  }

  // Phase P: bump, pack and check every package, then one clean-install over the tarballs of the run. Nothing is
  // published yet, so a stop here leaves npm as it was.
  let firstPrepared = true;
  for (const pkg of toRelease) {
    if (pkg.mode === 'tag') {
      continue;
    }

    const state = stateOf(pkg.name);
    for (const step of ReleaseChain.prepare({ pkg, options: planned, first: firstPrepared })) {
      const outcome = await execute(step, state);
      await persist();
      if (!outcome.ok) {
        return stopAfterRecording({ failed: state, label: step.label, detail: outcome.detail });
      }
    }
    firstPrepared = false;
    prepared.add(pkg.name);
  }
  for (const step of ReleaseChain.install({ names: full.map((pkg) => pkg.name) })) {
    const outcome = await execute(step, undefined);
    await persist();
    if (!outcome.ok) {
      return stopAfterRecording({
        failed: stateOf(full[0]?.name ?? ''),
        label: step.label,
        detail: outcome.detail,
      });
    }
  }

  // Phase B: publish every package, one after another, in order, and wait for nothing.
  for (const pkg of full) {
    const state = stateOf(pkg.name);
    for (const step of ReleaseChain.publish({ pkg, options: planned })) {
      const outcome = await execute(step, state);
      await persist();
      if (!outcome.ok) {
        return stopAfterRecording({ failed: state, label: step.label, detail: outcome.detail });
      }
    }
  }

  // Phase R: one wait for the tarballs (the first covers the lag of all), then the record of each package.
  const failedRecord = await recordAll();
  if (failedRecord !== undefined) {
    return stop(failedRecord);
  }

  // Phase C: a stable merges main back into develop, also when every package was already released.
  for (const step of ReleaseChain.mergeBack({ options: planned })) {
    const outcome = await execute(step, undefined);
    if (!outcome.ok) {
      const report = ReleaseChain.mergeBackReport({
        states,
        version,
        label: step.label,
        detail: outcome.detail,
        targetBranch,
      });
      stopped = { failed: 'merge back', label: step.label, detail: outcome.detail };
      await persist();
      ports.log(report);
      return { ok: false, states, report };
    }
    mergeBack = 'done';
    await persist();
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
      '[release-chain] use: --packages kernel,react --version <x.y.z[-pre]> [--issue N] [--branch name] [--tarballs dir] [--tmp dir] [--state file] [--target-branch develop|main] [--plan-version v --plan-kind prerelease|stable] [--dry-run]',
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
    targetBranch: value('--target-branch'),
    planVersion: value('--plan-version'),
    planKind: value('--plan-kind'),
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
  sha256: async ({ path }) => {
    const bytes = await Bun.file(path).bytes();

    return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
  },
  writeFile: async ({ path, content }) => {
    await Bun.write(path, content);
  },
  sleep: (ms) => new Promise<void>((done) => setTimeout(done, ms)),
  log: (line) => console.log(line),
  readBuiltOn: () => {
    const root = JSON.parse(readFileSync('package.json', 'utf8')) as {
      workspaces?: { catalog?: Record<string, string> };
    };

    return ReleaseChain.builtOnOf({ catalog: root.workspaces?.catalog ?? {} });
  },
});

const reportMain = async (opts: { argv: string[] }): Promise<void> => {
  const index = opts.argv.indexOf('--state');
  const statePath = index === -1 ? undefined : opts.argv[index + 1];
  if (!statePath) {
    throw new Error('[release-chain] use: report --state <file>');
  }

  // No file means the chain step never ran (an earlier step failed): there is nothing to report.
  const result = await Bun.file(statePath).exists();
  if (!result) {
    console.log('No release state was written: the release step did not start.');
    return;
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8')) as IChainState;
  const text = ReleaseChain.reportFromState({ state });
  console.log(text);

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    appendFileSync(summary, `\n\`\`\`\n${text}\n\`\`\`\n`);
  }
};

const main = async (): Promise<void> => {
  if (Bun.argv[2] === 'report') {
    await reportMain({ argv: Bun.argv.slice(3) });
    return;
  }

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
    targetBranch: args.targetBranch,
    plan:
      args.planVersion !== undefined &&
      (args.planKind === 'prerelease' || args.planKind === 'stable')
        ? { version: args.planVersion, kind: args.planKind }
        : undefined,
    builtOn: ports.readBuiltOn?.(),
  };

  if (args.dryRun) {
    const { phaseA, phaseP, phaseB, phaseR, phaseC } = ReleaseChain.plan({ options });
    console.log('Phase A: the checks before the first publish');
    for (const step of phaseA) console.log(`  ${ReleaseChain.describe({ step })}`);
    console.log('Phase P: prepare every package, one clean-install, nothing published');
    for (const step of phaseP) console.log(`  ${ReleaseChain.describe({ step })}`);
    console.log('Phase B: publish every package, no wait');
    for (const step of phaseB) console.log(`  ${ReleaseChain.describe({ step })}`);
    console.log('Phase R: wait for the tarballs, then record each package in git');
    for (const step of phaseR) console.log(`  ${ReleaseChain.describe({ step })}`);
    if (phaseC.length > 0) console.log('Phase C: after the last package');
    for (const step of phaseC) console.log(`  ${ReleaseChain.describe({ step })}`);
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
