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
 * artifacts, pack, protocols and registry. Phase B releases one package at a time: clean-install (its
 * siblings are read from the registry, so the previous package must be installable first), bump, the
 * preset (ardor), the tarball that is published, its sha256, the publish, the wait for the tarball to
 * answer 200, the dist-tags, then the release commit, the push and the tag. After any stop git equals
 * the registry: a package has its commit and its tag, or it was not published.
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

export type TStep =
  | { kind: 'run'; label: string; command: string[]; cwd?: string; fatal: boolean; stage?: TStage }
  | { kind: 'manifest'; label: string; tarball: string; out: string }
  | { kind: 'record-sha'; label: string; tarball: string }
  | { kind: 'verify-sha'; label: string; tarball: string }
  | { kind: 'publish'; label: string; command: string[]; cwd?: string }
  | { kind: 'wait'; label: string }
  | { kind: 'push-tag'; label: string; tag: string }
  | { kind: 'merge-back'; label: string };

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

  /** Phase B for one package, in the order of the card (D7). */
  static release(opts: { pkg: IChainPackage; options: IChainOptions; first: boolean }): TStep[] {
    const { pkg, options, first } = opts;
    const { version, npmTag, tarballs, tmp } = options;
    const dir = `packages/${pkg.name}`;
    const tarball = join(tarballs, `${pkg.name}.tgz`);
    const tag = `${pkg.name}-v${version}`;
    const targetBranch = ReleaseChain.targetBranchOf({ options });
    const isStable = ReleaseChain.kindOf({ options }) === 'stable';
    const tagMessage = `${pkg.packageName} v${version}${options.builtOn ? `\nbuilt on: ${options.builtOn}` : ''}`;
    const scratch = join(tmp, `relock-${pkg.name}`);
    const subject = `${options.issue === undefined ? '' : `[#${options.issue}] `}chore(${pkg.name}): release v${version} [${version}]`;

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
    phaseB: TStep[];
    phaseC: TStep[];
  } {
    const { options } = opts;

    return {
      phaseA: options.packages.flatMap((pkg) => ReleaseChain.checks({ pkg, options })),
      phaseB: options.packages.flatMap((pkg, index) =>
        ReleaseChain.release({ pkg, options, first: index === 0 }),
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
          `${name}@${version} is published and committed locally, but the push to ${target} did not land (the chain never rebases).`,
          `Pull ${target}, then push the release commit by hand, then create the tag.`,
        );
        break;
      }
      default: {
        lines.push(
          `${name}@${version} is published and ${target} is updated; only the tag is missing. Create it by hand:`,
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

  const isStable = ReleaseChain.kindOf({ options }) === 'stable';
  const targetBranch = ReleaseChain.targetBranchOf({ options });
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
    const { phaseA, phaseB, phaseC } = ReleaseChain.plan({ options });
    console.log('Phase A: the checks before the first publish');
    for (const step of phaseA) console.log(`  ${ReleaseChain.describe({ step })}`);
    console.log('Phase B: one package at a time');
    for (const step of phaseB) console.log(`  ${ReleaseChain.describe({ step })}`);
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
