/**
 * What a release is released AS: a semver bump (`--mode`) or an explicit version (`--version`). One
 * home for the argument parsing and the dist-tag rule, so `release.ts` and
 * `package-release.yml` cannot drift apart. `release.ts` runs on import, so
 * the rule lives here, where a test can reach it.
 *
 * `--version` overrides `--mode`. A stable version goes to `latest`, a version with a prerelease
 * part to `next`, the same rule the bump modes follow (`patch|minor|major` are stable).
 *
 * The workflow calls the command line of this file:
 *
 *   bun scripts/release/release-version.ts target --version <x.y.z|''> --mode <mode> [--current <x.y.z>]
 *
 * `--issue <N>` rides along in the same argument list (release.ts reads it here).
 *   bun scripts/release/release-version.ts tag <mode|x.y.z>
 */

import type { TConstValue } from '../const-value';

export class ReleaseModes {
  static readonly PATCH = 'patch';
  static readonly MINOR = 'minor';
  static readonly MAJOR = 'major';
  static readonly PREPATCH = 'prepatch';
  static readonly PREMINOR = 'preminor';
  static readonly PREMAJOR = 'premajor';
  static readonly PRERELEASE = 'prerelease';

  static readonly SCHEME_SET = new Set([
    this.PATCH,
    this.MINOR,
    this.MAJOR,
    this.PREPATCH,
    this.PREMINOR,
    this.PREMAJOR,
    this.PRERELEASE,
  ]);

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

export type TReleaseMode = TConstValue<typeof ReleaseModes>;

/** The npm dist-tag a release goes to. */
export class NpmTags {
  static readonly LATEST = 'latest';
  static readonly NEXT = 'next';

  static readonly SCHEME_SET = new Set([this.LATEST, this.NEXT]);

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

export type TNpmTag = TConstValue<typeof NpmTags>;

/** A mode from `RELEASE_MODES` or a semver version, as written. */
export type TReleaseTarget = string;

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
const DEFAULT_MODE: TReleaseMode = ReleaseModes.PRERELEASE;
const VALUE_FLAGS = ['--mode', '--version', '--current', '--issue'];

export const isReleaseMode = (opts: { value: string }): opts is { value: TReleaseMode } =>
  ReleaseModes.isValid(opts.value);

export const isReleaseVersion = (opts: { value: string }): boolean => SEMVER.test(opts.value);

export interface IReleaseArgs {
  target: TReleaseTarget;
  /** The package names, or any other argument that is neither a flag nor a flag's value. */
  positional: string[];
  current?: string;
  /** The issue number the release commit serves; the commit subject is prefixed `[#N]`. */
  issue?: string;
}

/** The value after `flag`; an empty one means the flag is unset. */
const readValue = (opts: { argv: string[]; flag: string }): string | undefined => {
  const index = opts.argv.indexOf(opts.flag);

  if (index === -1) {
    return undefined;
  }

  const value = opts.argv[index + 1];

  if (value === undefined || value.startsWith('--')) {
    throw new Error(`[readReleaseArgs] ${opts.flag} needs a value`);
  }

  return value === '' ? undefined : value;
};

export const readReleaseArgs = (opts: { argv: string[] }): IReleaseArgs => {
  const { argv } = opts;
  const mode = readValue({ argv, flag: '--mode' });
  const version = readValue({ argv, flag: '--version' });
  const current = readValue({ argv, flag: '--current' });
  const issue = readValue({ argv, flag: '--issue' });

  if (mode !== undefined && !isReleaseMode({ value: mode })) {
    throw new Error(
      `[readReleaseArgs] unknown --mode '${mode}' | expected one of: ${[...ReleaseModes.SCHEME_SET].join(', ')}`,
    );
  }

  if (version !== undefined && !isReleaseVersion({ value: version })) {
    throw new Error(
      `[readReleaseArgs] --version '${version}' is not a semver version (x.y.z[-pre])`,
    );
  }

  if (issue !== undefined && !/^\d+$/.test(issue)) {
    throw new Error(
      `[readReleaseArgs] --issue '${issue}' is not an issue number (digits only, no #)`,
    );
  }

  const positional = argv.filter(
    (arg, index) => !arg.startsWith('--') && !VALUE_FLAGS.includes(argv[index - 1] ?? ''),
  );

  return { target: version ?? mode ?? DEFAULT_MODE, positional, current, issue };
};

/** `latest` for a stable release, `next` for a prerelease: a mode starting `pre`, or `x.y.z-pre`. */
export const npmTagFor = (opts: { target: TReleaseTarget }): TNpmTag => {
  const { target } = opts;

  if (isReleaseMode({ value: target })) {
    return target.startsWith('pre') ? NpmTags.NEXT : NpmTags.LATEST;
  }

  if (isReleaseVersion({ value: target })) {
    return target.includes('-') ? NpmTags.NEXT : NpmTags.LATEST;
  }

  throw new Error(`[npmTagFor] '${target}' is neither a release mode nor a semver version`);
};

/** A release only moves up: `npm version` accepts an equal or lower explicit version. */
export const assertAbove = (opts: { version: string; current: string }): void => {
  if (Bun.semver.order(opts.version, opts.current) <= 0) {
    throw new Error(
      `[assertAbove] version ${opts.version} is not above the current ${opts.current}`,
    );
  }
};

/**
 * A shared version needs every package, changed or not, so a sweep releases each package still below
 * it and keeps the order it was given. A package already at the version is skipped, which also lets
 * a chain that stopped half way run again.
 */
export const packagesForVersion = <T extends { localVersion: string }>(opts: {
  states: T[];
  version: string;
}): T[] => opts.states.filter((state) => Bun.semver.order(state.localVersion, opts.version) < 0);

const main = (): void => {
  const [command, ...rest] = Bun.argv.slice(2);

  if (command === 'target') {
    const { target, current } = readReleaseArgs({ argv: rest });

    if (current !== undefined && isReleaseVersion({ value: target })) {
      assertAbove({ version: target, current });
    }

    console.log(target);
    return;
  }

  if (command === 'tag') {
    console.log(npmTagFor({ target: rest[0] ?? '' }));
    return;
  }

  throw new Error(`[release-version] unknown command '${command ?? ''}' | use target or tag`);
};

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
