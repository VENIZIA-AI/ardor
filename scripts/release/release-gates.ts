/**
 * The gates a package passes between its build and its publish, in one place: `package-release.yml`
 * calls the command line of this file and `preset-smoke.ts` imports the functions. They are the gates IGNIS's release workflow runs inline.
 *
 *   bun scripts/release/release-gates.ts artifacts <package-dir>        every file the `exports` map names exists
 *   bun scripts/release/release-gates.ts links <package-dir>            every ARDOR sibling resolves to the workspace
 *   bun scripts/release/release-gates.ts pack <package-dir> <out.json>  packs, writes the manifest npm will receive
 *   bun scripts/release/release-gates.ts protocols <manifest.json>      no catalog: or workspace: survives packing
 *   bun scripts/release/release-gates.ts registry <manifest.json> [--chain-released a,b]
 *                                                               every runtime dependency can be installed
 *   bun scripts/release/release-gates.ts heal-next [--published <name>@<version> --tag <tag>] [--dry-run]          `next` is never below `latest`, for every ARDOR package
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, sep } from 'node:path';

import { isReleaseVersion, NpmTags, type TNpmTag } from './release-version';

const SIBLING_PREFIX = '@venizia/ardor';
const PROTOCOL = /^(catalog|workspace):/;
const REGISTRY = 'https://registry.npmjs.org';

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toStringRecord = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};

const readJson = (opts: { path: string }): TRecord => {
  const value: unknown = JSON.parse(readFileSync(opts.path, 'utf8'));

  if (!isRecord(value)) {
    throw new Error(`[readJson] ${opts.path} | expected a JSON object`);
  }

  return value;
};

/** Derived from the package's own `exports` map, never a hand-written list. */
export const exportTargets = (opts: { exportsMap: unknown }): Set<string> => {
  if (!isRecord(opts.exportsMap)) {
    throw new Error('[exportTargets] no `exports` map - there is nothing to validate against');
  }

  const targets = new Set<string>();

  for (const target of Object.values(opts.exportsMap)) {
    if (typeof target === 'string') {
      targets.add(target);
      continue;
    }

    for (const file of Object.values(toStringRecord(target))) {
      targets.add(file);
    }
  }

  return targets;
};

export const missingExportTargets = (opts: { directory: string; exportsMap: unknown }): string[] =>
  [...exportTargets({ exportsMap: opts.exportsMap })].filter(
    file => !existsSync(join(opts.directory, file)),
  );

/** A `catalog:` or `workspace:` value in the packed manifest breaks every consumer's install. */
export const unresolvedProtocols = (opts: { manifest: unknown }): string[] => {
  const found: string[] = [];

  if (!isRecord(opts.manifest)) {
    return found;
  }

  for (const block of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    for (const [name, range] of Object.entries(toStringRecord(opts.manifest[block]))) {
      if (PROTOCOL.test(range)) {
        found.push(`${name}: ${range}`);
      }
    }
  }

  return found;
};

export const parseChainReleased = (opts: { value: string }): string[] =>
  opts.value
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);

/**
 * npm lists a version before it serves the tarball: for minutes after a publish a fresh `@venizia/*`
 * version resolves and its tarball answers 404. A 404 on exactly such a tarball is lag, not a
 * defect, and worth a retry; any other failure is not.
 */
const TARBALL_LAG = /error: GET https:\/\/registry\.npmjs\.org\/@venizia\/[^\s]+\.tgz - 404/;

export const isTarballLag = (opts: { output: string }): boolean => TARBALL_LAG.test(opts.output);

/** Five waits, six tries, about five minutes: the lag measured after a publish is three to sixteen. */
export const TARBALL_LAG_DELAYS_SECONDS = [30, 60, 60, 60, 60];

export interface IPackument {
  ok: boolean;
  status?: number;
  versions?: string[];
}

/**
 * A `workspace:*` on a package that was never published packs to a literal version, so the tarball
 * names a package the registry has never heard of. Only the registry can answer that. In a release
 * chain the previous package went out seconds ago and npm can take minutes to show it: such a package,
 * and only one named in `chainReleased` by the run that published it, is checked against its workspace
 * version instead.
 */
export const missingFromRegistry = async (opts: {
  dependencies: Record<string, string>;
  chainReleased: string[];
  workspaceVersions: Map<string, string>;
  fetchPackument: (opts: { name: string }) => Promise<IPackument>;
}): Promise<string[]> => {
  const missing: string[] = [];

  for (const [name, range] of Object.entries(opts.dependencies)) {
    if (opts.chainReleased.includes(name)) {
      const version = opts.workspaceVersions.get(name);

      if (version !== undefined && Bun.semver.satisfies(version, range)) {
        continue;
      }
    }

    let packument: IPackument;

    try {
      packument = await opts.fetchPackument({ name });
    } catch (error) {
      // A network failure is not "package not found", and it must not wave the release through.
      missing.push(
        `${name}@${range} - could not reach the registry (${error instanceof Error ? error.message : String(error)})`,
      );
      continue;
    }

    if (!packument.ok) {
      missing.push(
        `${name}@${range} - the package itself is not on the registry (HTTP ${packument.status ?? '?'})`,
      );
      continue;
    }

    if (!(packument.versions ?? []).some(version => Bun.semver.satisfies(version, range))) {
      missing.push(`${name}@${range} - no published version satisfies this range`);
    }
  }

  return missing;
};

export interface IDistTags {
  name: string;
  latest?: string;
  next?: string;
}

export interface IPublished {
  name: string;
  version: string;
  tag: TNpmTag;
}

/**
 * The package a run just published is known better than the registry: npm can serve the old tags for
 * minutes after a publish, and a heal that read them moved `next` to a stale `latest`. The published
 * version is the current value of its tag for that package; every other package keeps what the
 * registry said.
 */
export const withPublished = (opts: {
  packages: IDistTags[];
  published?: IPublished;
}): IDistTags[] => {
  const { published } = opts;

  if (published === undefined) {
    return opts.packages;
  }

  const known = opts.packages.some(entry => entry.name === published.name);
  const updated = opts.packages.map(entry =>
    entry.name === published.name ? { ...entry, [published.tag]: published.version } : entry,
  );

  return known
    ? updated
    : [...updated, { name: published.name, [published.tag]: published.version }];
};

const readFlag = (opts: { argv: string[]; flag: string }): string | undefined => {
  const index = opts.argv.indexOf(opts.flag);

  return index === -1 ? undefined : opts.argv[index + 1];
};

/** `--published @venizia/ardor@0.3.1 --tag latest`: what the run published, or undefined when nothing. */
export const parsePublished = (opts: { argv: string[] }): IPublished | undefined => {
  const value = readFlag({ argv: opts.argv, flag: '--published' });

  if (value === undefined) {
    return undefined;
  }

  const at = value.lastIndexOf('@');
  const name = at > 0 ? value.slice(0, at) : '';
  const version = at > 0 ? value.slice(at + 1) : '';

  if (name === '' || !isReleaseVersion({ value: version })) {
    throw new Error(
      `[parsePublished] --published '${value}' is not <name>@<version> with a semver version`,
    );
  }

  const tag = readFlag({ argv: opts.argv, flag: '--tag' });

  if (tag !== NpmTags.LATEST && tag !== NpmTags.NEXT) {
    throw new Error(`[parsePublished] --published needs --tag latest or next, got '${tag ?? ''}'`);
  }

  return { name, version, tag };
};

/**
 * The rule: the `next` dist-tag is never below `latest`. `next` may hold a prerelease of a later
 * version, but a release that moves `latest` past it would leave `bun add pkg@next` installing an
 * older version than a plain `bun add pkg`. A package with no `latest` has nothing to heal toward.
 */
export const nextTagsToHeal = (opts: {
  packages: IDistTags[];
}): Array<{ name: string; latest: string }> =>
  opts.packages.flatMap(entry =>
    entry.latest !== undefined &&
    (entry.next === undefined || Bun.semver.order(entry.next, entry.latest) < 0)
      ? [{ name: entry.name, latest: entry.latest }]
      : [],
  );

/**
 * Every ARDOR sibling a package declares is a member of this workspace, so one resolved to a registry
 * tarball means the declared range excludes the version in the tree and the build validates code that
 * is not in this repository. Install succeeds either way; the lie shows up as unrelated type errors.
 */
export const workspaceStrays = (opts: {
  root: string;
  directory: string;
  prefix?: string;
}): string[] => {
  const prefix = opts.prefix ?? SIBLING_PREFIX;
  const manifest = readJson({ path: join(opts.root, opts.directory, 'package.json') });
  const names = Object.keys({
    ...toStringRecord(manifest.dependencies),
    ...toStringRecord(manifest.devDependencies),
  })
    .filter(name => name.startsWith(prefix))
    .sort();
  const strays: string[] = [];

  for (const name of names) {
    const found = [
      join(opts.root, opts.directory, 'node_modules', name),
      join(opts.root, 'node_modules', name),
    ].find(path => existsSync(path));

    if (found === undefined) {
      strays.push(`${name} - declared but not installed`);
      continue;
    }

    const real = realpathSync(found);

    if (!real.includes(`${sep}node_modules${sep}`)) {
      continue;
    }

    const version = readJson({ path: join(real, 'package.json') }).version;

    strays.push(`${name} - resolved to the published ${String(version)}, not the workspace copy`);
  }

  return strays;
};

export const readWorkspaceVersions = (opts: { root: string }): Map<string, string> => {
  const versions = new Map<string, string>();

  for (const file of new Bun.Glob('packages/*/package.json').scanSync({ cwd: opts.root })) {
    const { name, version } = readJson({ path: join(opts.root, file) });

    if (typeof name === 'string' && typeof version === 'string') {
      versions.set(name, version);
    }
  }

  return versions;
};

export const fetchPackument = async (opts: { name: string }): Promise<IPackument> => {
  const response = await fetch(`${REGISTRY}/${opts.name}`);

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const body: unknown = await response.json();
  const versions = isRecord(body) && isRecord(body.versions) ? Object.keys(body.versions) : [];

  return { ok: true, versions };
};

const fetchDistTags = async (opts: { name: string }): Promise<IDistTags> => {
  const response = await fetch(`${REGISTRY}/-/package/${opts.name.replace('/', '%2F')}/dist-tags`);

  if (!response.ok) {
    return { name: opts.name };
  }

  const body: unknown = await response.json();
  const tags = toStringRecord(body);

  return { name: opts.name, latest: tags.latest, next: tags.next };
};

const fail = (opts: { lines: string[] }): never => {
  for (const line of opts.lines) {
    console.error(line);
  }

  process.exit(1);
};

const main = async (): Promise<void> => {
  const [command, first, second, ...rest] = Bun.argv.slice(2);
  const root = process.cwd();

  if (command === 'artifacts' && first !== undefined) {
    const manifest = readJson({ path: join(first, 'package.json') });
    const targets = exportTargets({ exportsMap: manifest.exports });
    const missing = missingExportTargets({ directory: first, exportsMap: manifest.exports });

    if (missing.length > 0) {
      fail({
        lines: [
          'ERROR: `exports` names files the build did not emit:',
          ...missing.map(file => `  ${file}`),
        ],
      });
    }

    console.log(`    ✓ all ${targets.size} published entries exist`);
    return;
  }

  if (command === 'links' && first !== undefined) {
    const strays = workspaceStrays({ root, directory: first });

    if (strays.length > 0) {
      fail({
        lines: [
          'ERROR: internal dependencies resolved to the registry, not this workspace:',
          ...strays.map(stray => `  ${stray}`),
          'Raise the range so it covers the version in packages/, then re-run.',
        ],
      });
    }

    console.log('    ✓ every ARDOR sibling links to the workspace');
    return;
  }

  if (command === 'pack' && first !== undefined && second !== undefined) {
    const packed = Bun.spawnSync(['bun', 'pm', 'pack', '--quiet'], {
      cwd: first,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (packed.exitCode !== 0) {
      fail({ lines: [`ERROR: bun pm pack failed in ${first}`, packed.stderr.toString()] });
    }

    // The tarball name comes from `bun pm pack`'s own stdout, never a glob.
    const tarball = packed.stdout.toString().trim().split('\n').pop() ?? '';

    if (!tarball.endsWith('.tgz')) {
      fail({ lines: [`ERROR: bun pm pack did not name a tarball - got: ${tarball || '<empty>'}`] });
    }

    const read = Bun.spawnSync(['tar', '-xzOf', tarball, 'package/package.json'], {
      cwd: first,
      stdout: 'pipe',
    });

    await Bun.write(second, read.stdout);
    Bun.spawnSync(['rm', '-f', join(first, tarball)]);
    console.log(`    ✓ extracted the manifest from ${tarball}`);
    return;
  }

  if (command === 'protocols' && first !== undefined) {
    const found = unresolvedProtocols({ manifest: readJson({ path: first }) });

    if (found.length > 0) {
      fail({
        lines: [
          'ERROR: unresolved workspace protocol survives into the published manifest:',
          ...found.map(entry => `  ${entry}`),
        ],
      });
    }

    console.log('    ✓ the packed manifest resolves every protocol');
    return;
  }

  if (command === 'registry' && first !== undefined) {
    const manifest = readJson({ path: first });
    const dependencies = toStringRecord(manifest.dependencies);
    const flag = [second, ...rest].indexOf('--chain-released');
    const value = flag === -1 ? '' : ([second, ...rest][flag + 1] ?? '');
    const missing = await missingFromRegistry({
      dependencies,
      chainReleased: parseChainReleased({ value }),
      workspaceVersions: readWorkspaceVersions({ root }),
      fetchPackument,
    });

    if (missing.length > 0) {
      fail({
        lines: [
          'ERROR: the packed manifest depends on something the registry cannot serve:',
          ...missing.map(entry => `  - ${entry}`),
        ],
      });
    }

    console.log(
      `    ✓ all ${Object.keys(dependencies).length} runtime dependencies resolve on the registry`,
    );
    return;
  }

  if (command === 'heal-next') {
    const args = Bun.argv.slice(3);
    const dryRun = args.includes('--dry-run');
    const published = parsePublished({ argv: args });
    const names = [...readWorkspaceVersions({ root }).keys()]
      .filter(name => name.startsWith(SIBLING_PREFIX))
      .sort();
    const registry = await Promise.all(names.map(name => fetchDistTags({ name })));
    const packages = withPublished({ packages: registry, published });
    const healed = nextTagsToHeal({ packages });

    for (const entry of packages) {
      console.log(`    ${entry.name}: latest ${entry.latest ?? '-'}, next ${entry.next ?? '-'}`);
    }

    // Non-fatal and loud: a release that published must not fail over a dist-tag.
    for (const { name, latest } of healed) {
      const tag = Bun.spawnSync(
        dryRun
          ? ['echo', 'dry run:', 'npm', 'dist-tag', 'add', `${name}@${latest}`, 'next']
          : ['npm', 'dist-tag', 'add', `${name}@${latest}`, 'next'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        },
      );

      console.log(
        tag.exitCode === 0
          ? `    ⚠️  next was below latest: moved ${name}@next to ${latest}${dryRun ? ' (dry run)' : ''}`
          : `    ⚠️  could not move ${name}@next to ${latest} (non-fatal): ${tag.stderr.toString().trim()}`,
      );
    }

    console.log(
      healed.length === 0
        ? '    ✓ next is at or above latest for every ARDOR package'
        : `    ${healed.length} package(s) healed`,
    );
    return;
  }

  throw new Error(
    '[release-gates] use: artifacts <dir> | links <dir> | pack <dir> <out> | protocols <file> | registry <file> [--chain-released a,b] | heal-next [--dry-run]',
  );
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
