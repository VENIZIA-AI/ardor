/**
 * What one release run releases: the packages, in dependency order, and the one version they share.
 *
 * `release.ts` runs the release; this file holds the rules it follows, so a test can reach them. All
 * four ARDOR packages share one version per run: the umbrella pins its siblings by exact version, and a
 * subset at different versions is a release nobody can install.
 *
 * The workflow runs the `resolve` command below in both of its jobs, before any build:
 *
 *   bun scripts/release/release-plan.ts resolve --packages kernel,react --version 0.4.6-0
 *   bun scripts/release/release-plan.ts resolve --packages kernel,react,admin,ardor --mode prerelease
 *
 * It prints the one version of the run, or fails naming the cause (unknown or out-of-order package,
 * packages at different versions under a mode, a package above an explicit version).
 *
 * The `plan` job runs the `plan` command, which decides more before anything is built: the kind of the
 * version (a prerelease needs no approval, a stable needs one), the branch it may run from (a prerelease
 * from develop, a stable from main and only over a prerelease), the dist-tag, and for a stable that IGNIS
 * has a stable at least as new as the one the prerelease was built on:
 *
 *   bun scripts/release/release-plan.ts plan --packages kernel,react,admin,ardor --mode patch --ref refs/heads/main
 *
 * It prints the resolved version, writes `version`, `kind`, `npm_tag` and `catalog_tag` to GITHUB_OUTPUT
 * and a summary to GITHUB_STEP_SUMMARY, and exits 1 with every reason when it refuses.
 */

import { appendFileSync, readFileSync } from 'node:fs';

import { fetchDistTags } from './release-gates';
import {
  isReleaseMode,
  isReleaseVersion,
  readReleaseArgs,
  type TReleaseTarget,
} from './release-version';

/** A package of the plan, by workspace folder name, with the version its manifest holds. */
export interface IPlannedPackage {
  name: string;
  localVersion: string;
}

export interface IResolvedRun {
  /** The one version every planned package is released at. */
  version: string;
  /** The packages to release, in dependency order. */
  plan: string[];
  /** The packages already at the version, which an explicit-version resume leaves alone. */
  skipped: string[];
}

export interface IDispatch {
  workflow: string;
  ref: string;
  inputs: { packages: string; version: string; issue?: string };
}

export class ReleaseKinds {
  static readonly PRERELEASE = 'prerelease';
  static readonly STABLE = 'stable';
}

export type TReleaseKind = typeof ReleaseKinds.PRERELEASE | typeof ReleaseKinds.STABLE;

/** What one dispatch releases and under which tags, decided before anything is built. */
export interface IRunPlan {
  version: string;
  kind: TReleaseKind;
  /** The dist-tag the publish goes under: `next` for a prerelease, `latest` for a stable. */
  npmTag: 'next' | 'latest';
  /** The IGNIS line the run builds on: the highest for a prerelease, `latest` for a stable. */
  catalogTag: 'highest' | 'latest';
  /** The packages to release, in dependency order. */
  packages: string[];
  /** The packages already at the version. */
  skipped: string[];
}

export interface IPlanResult {
  plan: IRunPlan | undefined;
  problems: string[];
}

interface IParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const NUMERIC = /^(0|[1-9]\d*)$/;

export class ReleasePlan {
  /**
   * Dependency order, not alphabetical. A package must publish after everything it depends on, or the
   * release's own registry-existence gate fails on a version that is not out yet.
   */
  static readonly ORDER = ['kernel', 'react', 'admin', 'ardor'] as const;

  static readonly WORKFLOW = 'package-release.yml';

  /** A prerelease run is dispatched on this ref. */
  static readonly REF = 'develop';

  static readonly DEVELOP_REF = 'refs/heads/develop';

  static readonly MAIN_REF = 'refs/heads/main';

  /** The line of a release tag message that names the IGNIS versions the package was built on. */
  static readonly BUILT_ON = 'built on: ';

  /** A plan is an in-order selection of `ORDER`: no unknown name, no repeat, no other order, not empty. */
  static validate(opts: { packages: readonly string[] }): void {
    const { packages } = opts;
    const order: readonly string[] = ReleasePlan.ORDER;

    if (packages.length === 0) {
      throw new Error(`[ReleasePlan.validate] the plan is empty | known: ${order.join(', ')}`);
    }

    const unknown = packages.filter((name) => !order.includes(name));
    if (unknown.length > 0) {
      throw new Error(
        `[ReleasePlan.validate] unknown package(s): ${unknown.join(', ')} | known: ${order.join(', ')}`,
      );
    }

    const repeated = packages.filter((name, index) => packages.indexOf(name) !== index);
    if (repeated.length > 0) {
      throw new Error(
        `[ReleasePlan.validate] repeated package(s): ${[...new Set(repeated)].join(', ')}`,
      );
    }

    const positions = packages.map((name) => order.indexOf(name));
    if (positions.some((position, index) => index > 0 && position < (positions[index - 1] ?? 0))) {
      throw new Error(
        `[ReleasePlan.validate] ${packages.join(',')} is not in dependency order | expected: ${order.join(',')}`,
      );
    }
  }

  private static parse(opts: { version: string }): IParsedVersion {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(opts.version);
    if (!match) {
      throw new Error(
        `[ReleasePlan.increment] '${opts.version}' is not a version without build metadata (x.y.z or x.y.z-pre)`,
      );
    }

    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
      prerelease: match[4] ? match[4].split('.') : [],
    };
  }

  /**
   * The version `npm version <mode>` gives, computed here so the run prints it before it publishes. It
   * follows the rules of npm's `semver.inc`: a stable bump over a prerelease can land on the version the
   * prerelease was heading to (`0.4.9-1` and `patch` give `0.4.9`; `0.4.0-1` and `minor` give `0.4.0`).
   */
  static increment(opts: { current: string; mode: string }): string {
    const { current, mode } = opts;
    if (!isReleaseMode({ value: mode })) {
      throw new Error(`[ReleasePlan.increment] unknown mode '${mode}'`);
    }

    const parsed = ReleasePlan.parse({ version: current });
    let { major, minor, patch } = parsed;
    let prerelease = parsed.prerelease;
    const hasPrerelease = prerelease.length > 0;

    const startPrerelease = () => {
      prerelease = ['0'];
    };

    switch (mode) {
      case 'patch': {
        if (!hasPrerelease) {
          patch += 1;
        }
        prerelease = [];
        break;
      }
      case 'minor': {
        if (patch !== 0 || !hasPrerelease) {
          minor += 1;
        }
        patch = 0;
        prerelease = [];
        break;
      }
      case 'major': {
        if (minor !== 0 || patch !== 0 || !hasPrerelease) {
          major += 1;
        }
        minor = 0;
        patch = 0;
        prerelease = [];
        break;
      }
      case 'prepatch': {
        patch += 1;
        startPrerelease();
        break;
      }
      case 'preminor': {
        minor += 1;
        patch = 0;
        startPrerelease();
        break;
      }
      case 'premajor': {
        major += 1;
        minor = 0;
        patch = 0;
        startPrerelease();
        break;
      }
      default: {
        // prerelease: count up the last numeric identifier, or start one.
        if (!hasPrerelease) {
          patch += 1;
          startPrerelease();
          break;
        }

        const last = prerelease.length - 1;
        const lastIdentifier = prerelease[last] ?? '';
        prerelease = NUMERIC.test(lastIdentifier)
          ? [...prerelease.slice(0, last), String(Number(lastIdentifier) + 1)]
          : [...prerelease, '0'];
      }
    }

    return `${major}.${minor}.${patch}${prerelease.length > 0 ? `-${prerelease.join('.')}` : ''}`;
  }

  /**
   * The one version of a run and the packages to release at it.
   *
   * A bump mode needs every package at the same current version, because a mode applied to different
   * versions gives different results; it stops and names them. An explicit version is the way to resume a
   * run that stopped half way: packages below it are planned, packages at it are skipped, and one above it
   * stops the run.
   */
  static resolveVersion(opts: {
    target: TReleaseTarget;
    packages: readonly IPlannedPackage[];
  }): IResolvedRun {
    const { target, packages } = opts;
    ReleasePlan.validate({ packages: packages.map((planned) => planned.name) });

    if (isReleaseVersion({ value: target })) {
      const above = packages.filter(
        (planned) => Bun.semver.order(planned.localVersion, target) > 0,
      );
      if (above.length > 0) {
        throw new Error(
          `[ReleasePlan.resolveVersion] ${above.map((planned) => `${planned.name} is at ${planned.localVersion}`).join(', ')}, above ${target}`,
        );
      }

      const below = packages.filter(
        (planned) => Bun.semver.order(planned.localVersion, target) < 0,
      );
      return {
        version: target,
        plan: below.map((planned) => planned.name),
        skipped: packages
          .filter((planned) => !below.includes(planned))
          .map((planned) => planned.name),
      };
    }

    const versions = [...new Set(packages.map((planned) => planned.localVersion))];
    if (versions.length > 1) {
      const listed = packages
        .map((planned) => `${planned.name} ${planned.localVersion}`)
        .join(', ');
      throw new Error(
        `[ReleasePlan.resolveVersion] the packages are at different versions (${listed}) | a mode needs one current version; pass --version <x.y.z> to release them all at one`,
      );
    }

    const [current] = versions;
    if (current === undefined) {
      throw new Error('[ReleasePlan.resolveVersion] no package to release');
    }

    return {
      version: ReleasePlan.increment({ current, mode: target }),
      plan: packages.map((planned) => planned.name),
      skipped: [],
    };
  }

  /** The version of a run read from the manifests of its packages: the `resolve` command. */
  static resolveFromManifests(opts: { argv: string[]; root?: string }): string {
    const { argv } = opts;
    const root = opts.root ?? '.';
    const flag = (name: string): string | undefined => {
      const index = argv.indexOf(name);
      return index === -1 ? undefined : argv[index + 1];
    };
    const names = (flag('--packages') ?? '').split(',').filter(Boolean);
    ReleasePlan.validate({ packages: names });

    const { target } = readReleaseArgs({ argv: argv.filter((arg) => arg !== '--packages') });
    const packages = names.map((name) => ({
      name,
      localVersion: (
        JSON.parse(readFileSync(`${root}/packages/${name}/package.json`, 'utf8')) as {
          version: string;
        }
      ).version,
    }));

    return ReleasePlan.resolveVersion({ target, packages }).version;
  }

  /** A version with a prerelease part (`0.4.9-1`) is a prerelease, anything else a stable. */
  static kindOf(opts: { version: string }): TReleaseKind {
    return opts.version.includes('-') ? ReleaseKinds.PRERELEASE : ReleaseKinds.STABLE;
  }

  /** Why a version of this kind may not run from this ref; empty when it may. */
  static checkRef(opts: { ref: string; kind: TReleaseKind }): string[] {
    const { DEVELOP_REF, MAIN_REF } = ReleasePlan;

    if (opts.ref !== DEVELOP_REF && opts.ref !== MAIN_REF) {
      return [
        `the release workflow runs from develop (a prerelease) or main (a stable), not ${opts.ref}`,
      ];
    }

    if (opts.kind === ReleaseKinds.PRERELEASE && opts.ref === MAIN_REF) {
      return ['a prerelease runs from develop, not main'];
    }

    if (opts.kind === ReleaseKinds.STABLE && opts.ref === DEVELOP_REF) {
      return ['a stable release runs from main, not develop'];
    }

    return [];
  }

  /**
   * A stable is the promotion of a prerelease that was tested on `next`; a stable that nobody tested is
   * refused. A bump mode needs a prerelease on every package (over a stable it would invent a version).
   * An explicit stable version `X` is accepted when every package is a prerelease whose `patch`, `minor`
   * or `major` increment is `X`, or is already at `X` (a run that stopped half way).
   */
  static checkPromotion(opts: {
    target: TReleaseTarget;
    kind: TReleaseKind;
    packages: readonly IPlannedPackage[];
  }): string[] {
    const { target, kind, packages } = opts;
    if (kind !== ReleaseKinds.STABLE) {
      return [];
    }

    if (!isReleaseVersion({ value: target })) {
      const stable = packages.filter(
        (planned) => ReleasePlan.kindOf({ version: planned.localVersion }) === ReleaseKinds.STABLE,
      );

      return stable.map(
        (planned) =>
          `main is at ${planned.localVersion} (${planned.name}), a stable: a stable bump promotes a prerelease, so there is nothing to promote (a stable already exists for it)`,
      );
    }

    const promotes = (current: string): boolean =>
      current === target ||
      (ReleasePlan.kindOf({ version: current }) === ReleaseKinds.PRERELEASE &&
        ['patch', 'minor', 'major'].some(
          (mode) => ReleasePlan.increment({ current, mode }) === target,
        ));
    const apart = packages.filter((planned) => !promotes(planned.localVersion));

    return apart.length === 0
      ? []
      : [
          `${apart.map((planned) => `${planned.name} is at ${planned.localVersion}`).join(', ')}: ${target} is not the promotion of a prerelease (patch, minor or major of it), so it was never tested on next`,
        ];
  }

  /** The release a dispatch would make, and every reason it may not. */
  static plan(opts: {
    target: TReleaseTarget;
    packages: readonly IPlannedPackage[];
    ref: string;
    issue?: string;
  }): IPlanResult {
    const { target, packages, ref, issue } = opts;

    if (issue !== undefined && issue !== '' && !/^\d+$/.test(issue)) {
      return { plan: undefined, problems: [`the issue must be a number, not '${issue}'`] };
    }

    let resolved: IResolvedRun;
    try {
      resolved = ReleasePlan.resolveVersion({ target, packages });
    } catch (error) {
      return {
        plan: undefined,
        problems: [error instanceof Error ? error.message : String(error)],
      };
    }

    const kind = ReleasePlan.kindOf({ version: resolved.version });
    const plan: IRunPlan = {
      version: resolved.version,
      kind,
      npmTag: kind === ReleaseKinds.PRERELEASE ? 'next' : 'latest',
      catalogTag: kind === ReleaseKinds.PRERELEASE ? 'highest' : 'latest',
      packages: resolved.plan,
      skipped: resolved.skipped,
    };

    return {
      plan,
      problems: [
        ...ReleasePlan.checkRef({ ref, kind }),
        ...(ref === ReleasePlan.MAIN_REF
          ? ReleasePlan.checkPromotion({ target, kind, packages })
          : []),
      ],
    };
  }

  /**
   * The tag of the prerelease a stable promotes: the one of the last planned package that is still a
   * prerelease (a run tags in dependency order, so its last tag holds all four bumps). Absent when none is.
   */
  static prereleaseTagOf(opts: { packages: readonly IPlannedPackage[] }): string | undefined {
    const last = [...opts.packages]
      .reverse()
      .find(
        (planned) =>
          ReleasePlan.kindOf({ version: planned.localVersion }) === ReleaseKinds.PRERELEASE,
      );

    return last === undefined ? undefined : `${last.name}-v${last.localVersion}`;
  }

  /** The `name=version` pairs of the `built on:` line of a tag message; empty when it has none. */
  static parseBuiltOn(opts: { message: string }): Array<{ name: string; version: string }> {
    const line = opts.message
      .split('\n')
      .find((candidate) => candidate.startsWith(ReleasePlan.BUILT_ON));

    return line === undefined
      ? []
      : line
          .slice(ReleasePlan.BUILT_ON.length)
          .split(',')
          .map((pair) => pair.trim())
          .filter(Boolean)
          .map((pair) => {
            const at = pair.lastIndexOf('=');

            return { name: pair.slice(0, at), version: pair.slice(at + 1) };
          });
  }

  /**
   * A stable ships on IGNIS stable: every IGNIS package the prerelease was built on must have a `latest`
   * at least as new. `message` is the tag message of the prerelease; absent or without the line (a
   * prerelease made before the line existed) it cannot be checked, so the stable is refused.
   */
  static async checkBuiltOn(opts: {
    tag: string;
    message: string | undefined;
    latestOf: (opts: { name: string }) => Promise<string | undefined>;
  }): Promise<string[]> {
    const builtOn = ReleasePlan.parseBuiltOn({ message: opts.message ?? '' });
    if (builtOn.length === 0) {
      return [
        `the tag ${opts.tag} has no '${ReleasePlan.BUILT_ON.trim()}' line, so what IGNIS it was built on is unknown: publish a new prerelease and promote that`,
      ];
    }

    const problems: string[] = [];
    for (const { name, version } of builtOn) {
      const latest = await opts.latestOf({ name });

      if (latest === undefined) {
        problems.push(
          `IGNIS stable is not out: ${name} has no latest, the prerelease was built on ${version}`,
        );
      } else if (Bun.semver.order(latest, version) < 0) {
        problems.push(
          `IGNIS stable is not out: ${name} latest ${latest}, the prerelease was built on ${version}`,
        );
      }
    }

    return problems;
  }

  /** What the run page shows about the plan: the target, the tags and who has to approve it. */
  static summaryOf(opts: { plan: IRunPlan; target: TReleaseTarget; ref: string }): string {
    const { plan } = opts;
    const approval =
      plan.kind === ReleaseKinds.STABLE
        ? 'one approval, on the release-approval environment'
        : 'none (a prerelease needs no approval)';

    return [
      '### Release plan',
      '',
      `- Target: **${plan.version}** (${plan.kind}), from \`${opts.target}\` on \`${opts.ref}\``,
      `- Published under the \`${plan.npmTag}\` dist-tag, on the IGNIS \`${plan.catalogTag}\` line`,
      `- Approval: ${approval}`,
      `- Packages: ${plan.packages.join(', ') || 'none (all already at the version)'}`,
      '',
    ].join('\n');
  }

  /** The single dispatch of a run: what `gh workflow run` is sent, and nothing else. */
  static dispatch(opts: { plan: readonly string[]; version: string; issue?: string }): IDispatch {
    ReleasePlan.validate({ packages: opts.plan });

    return {
      workflow: ReleasePlan.WORKFLOW,
      ref: ReleasePlan.REF,
      inputs: {
        packages: opts.plan.join(','),
        version: opts.version,
        ...(opts.issue === undefined ? {} : { issue: opts.issue }),
      },
    };
  }

  /** The `gh workflow run` argument list of a dispatch. */
  static dispatchArgs(opts: { dispatch: IDispatch }): string[] {
    const { workflow, ref, inputs } = opts.dispatch;

    return [
      'gh',
      'workflow',
      'run',
      workflow,
      '--ref',
      ref,
      ...Object.entries(inputs).flatMap(([key, value]) => ['-f', `${key}=${value}`]),
    ];
  }

  /** One line for the operator: the dispatch that a plan would send. */
  static describe(opts: { dispatch: IDispatch }): string {
    const { workflow, ref, inputs } = opts.dispatch;
    const issue = inputs.issue === undefined ? '' : ` issue=${inputs.issue}`;

    return `1 dispatch of ${workflow} on ${ref}: packages=${inputs.packages} version=${inputs.version}${issue}`;
  }
}

/** The `plan` command: print the plan, write the job outputs, and exit 1 with every reason it refuses. */
const runPlan = async (opts: { argv: string[] }): Promise<number> => {
  const { argv } = opts;
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  const names = (flag('--packages') ?? '').split(',').filter(Boolean);
  const ref = flag('--ref');
  ReleasePlan.validate({ packages: names });

  if (ref === undefined) {
    throw new Error('[release-plan] plan needs --ref <refs/heads/...>');
  }

  const { target, issue } = readReleaseArgs({
    argv: argv.filter(
      (arg, index) => arg !== '--packages' && argv[index - 1] !== '--ref' && arg !== '--ref',
    ),
  });
  const packages = names.map((name) => ({
    name,
    localVersion: (
      JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8')) as { version: string }
    ).version,
  }));
  const { plan, problems } = ReleasePlan.plan({ target, packages, ref, issue });

  if (plan !== undefined) {
    console.log(`plan: ${plan.version} (${plan.kind}) from ${target} on ${ref}`);
  }

  if (plan?.kind === ReleaseKinds.STABLE && problems.length === 0) {
    const tag = ReleasePlan.prereleaseTagOf({
      packages: packages.filter((planned) => plan.packages.includes(planned.name)),
    });

    if (tag !== undefined) {
      const message = Bun.spawnSync(['git', 'tag', '-l', '--format=%(contents)', tag])
        .stdout.toString()
        .trim();

      problems.push(
        ...(await ReleasePlan.checkBuiltOn({
          tag,
          message: message === '' ? undefined : message,
          latestOf: async ({ name }) => (await fetchDistTags({ name })).latest,
        })),
      );
    }
  }

  for (const problem of problems) {
    console.error(`ERROR | ${problem}`);
  }

  if (plan === undefined || problems.length > 0) {
    return 1;
  }

  const output = process.env.GITHUB_OUTPUT;
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (output !== undefined) {
    appendFileSync(
      output,
      `version=${plan.version}\nkind=${plan.kind}\nnpm_tag=${plan.npmTag}\ncatalog_tag=${plan.catalogTag}\n`,
    );
  }
  if (summary !== undefined) {
    appendFileSync(summary, ReleasePlan.summaryOf({ plan, target, ref }));
  }

  return 0;
};

if (import.meta.main) {
  try {
    const [command, ...rest] = Bun.argv.slice(2);
    if (command === 'resolve') {
      console.log(ReleasePlan.resolveFromManifests({ argv: rest }));
    } else if (command === 'plan') {
      process.exit(await runPlan({ argv: rest }));
    } else {
      throw new Error(`[release-plan] unknown command '${command ?? ''}' | use resolve or plan`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
