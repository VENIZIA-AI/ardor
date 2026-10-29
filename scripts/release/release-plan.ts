/**
 * What one release run releases: the packages, in dependency order, and the one version they share.
 *
 * `release.ts` runs the release; this file holds the rules it follows, so a test can reach them. All
 * four ARDOR packages share one version per run: the umbrella pins its siblings by exact version, and a
 * subset at different versions is a release nobody can install.
 */

import { isReleaseMode, isReleaseVersion, type TReleaseTarget } from './release-version';

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

  /** The run is dispatched on this ref; a stable run from `main` is a later slice. */
  static readonly REF = 'develop';

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
