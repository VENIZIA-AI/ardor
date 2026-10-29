/**
 * The gates a package passes between its build and its publish, in one place: `package-release.yml`
 * calls the command line of this file and `preset-smoke.ts` imports the functions. They are the gates IGNIS's release workflow runs inline.
 *
 *   bun scripts/release/release-gates.ts artifacts <package-dir>        every file the `exports` map names exists
 *   bun scripts/release/release-gates.ts links <package-dir>            every ARDOR sibling resolves to the workspace
 *   bun scripts/release/release-gates.ts single-copy [<root>]           every @venizia/* package resolves to one version
 *   bun scripts/release/release-gates.ts pack <package-dir> <out.json>  packs, writes the manifest npm will receive
 *   bun scripts/release/release-gates.ts protocols <manifest.json>      no catalog: or workspace: survives packing
 *   bun scripts/release/release-gates.ts registry <manifest.json> [--chain-released a,b]
 *                                                               every runtime dependency can be installed
 *   bun scripts/release/release-gates.ts heal-next [--published <name>@<version> --tag <tag>] [--dry-run]          `next` is never below `latest`, for every ARDOR package
 *   bun scripts/release/release-gates.ts tag-highest --published <name>@<version> [--dry-run]
 *                                                               `highest` moves only to a semver-greater version
 *   bun scripts/release/release-gates.ts stable-deps <manifest.json | folder>
 *                                                               no non-ARDOR @venizia/* range has a prerelease part
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
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
    (file) => !existsSync(join(opts.directory, file)),
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

/** The text of a file without its comment lines (YAML `#`, TypeScript `//` and block comments). */
const withoutCommentLines = (opts: { text: string }): string =>
  opts.text.replace(/^\s*(#|\/\/|\*|\/\*).*$/gm, '');

/**
 * Only `bun pm pack` resolves `catalog:` and `workspace:`; npm then publishes that tarball with a provenance.
 * The workflow runs the chain in one step and the chain holds the pack and the publish, so the preflight reads
 * both: the workflow must call the chain, and the chain must pack with bun and publish with a provenance.
 */
export const isTrustedPublishWorkflow = (opts: { workflow: string; chain: string }): boolean => {
  const workflow = withoutCommentLines({ text: opts.workflow });
  const chain = withoutCommentLines({ text: opts.chain });

  return (
    /^\s*bun scripts\/release\/release-chain\.ts (?!report\b)/m.test(workflow) &&
    /'bun',\s*'pm',\s*'pack'/.test(chain) &&
    /'npm',\s*'publish',[^\]]*'--provenance'/.test(chain)
  );
};

export const parseChainReleased = (opts: { value: string }): string[] =>
  opts.value
    .split(',')
    .map((name) => name.trim())
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

    if (!(packument.versions ?? []).some((version) => Bun.semver.satisfies(version, range))) {
      missing.push(`${name}@${range} - no published version satisfies this range`);
    }
  }

  return missing;
};

export interface IDistTags {
  name: string;
  latest?: string;
  next?: string;
  highest?: string;
}

/** The blocks of a manifest or a preset that name packages and the ranges they ask for. */
const RANGE_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'peers',
] as const;

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

  const known = opts.packages.some((entry) => entry.name === published.name);
  const updated = opts.packages.map((entry) =>
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
  opts.packages.flatMap((entry) =>
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
    .filter((name) => name.startsWith(prefix))
    .sort();
  const strays: string[] = [];

  for (const name of names) {
    const found = [
      join(opts.root, opts.directory, 'node_modules', name),
      join(opts.root, 'node_modules', name),
    ].find((path) => existsSync(path));

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

/**
 * One `@venizia/*` package must resolve to one version in the installed graph. Two copies of IGNIS
 * inversion are two nominal sets of types: the install succeeds, and the lie surfaces as an
 * `Application` that is "not assignable to IContainer". A peer range without a prerelease part
 * (`^0.4.1`) never matches `0.4.5-0`, so a workspace that does not declare the package itself gets
 * the stable copy next to the prerelease the rest of the tree uses.
 *
 * Walks what resolves, not what sits in the store (`node_modules/.bun` keeps every version ever
 * installed): the packages the root and each workspace member see, then the siblings each of those
 * sees. Returns one line per package with more than one version, naming who resolves each.
 */
export const duplicateCopies = (opts: { root: string }): string[] => {
  const seen = new Map<string, Map<string, Set<string>>>();
  const visited = new Set<string>();
  const queue: { directory: string; via: string; member: boolean }[] = [
    { directory: opts.root, via: '.', member: true },
    ...[...new Bun.Glob('packages/*/package.json').scanSync({ cwd: opts.root })].map((file) => ({
      directory: join(opts.root, file, '..'),
      via: file.replace(/\/package\.json$/, ''),
      member: true,
    })),
  ];

  while (queue.length > 0) {
    const { directory, via, member } = queue.shift() ?? { directory: '', via: '', member: false };
    const scope = join(directory, 'node_modules', '@venizia');

    if (!existsSync(scope)) {
      continue;
    }

    for (const entry of readdirSync(scope)) {
      const real = realpathSync(join(scope, entry));
      const manifestPath = join(real, 'package.json');

      if (!existsSync(manifestPath)) {
        continue;
      }

      const { name, version } = readJson({ path: manifestPath });

      if (typeof name !== 'string' || typeof version !== 'string') {
        continue;
      }

      const versions = seen.get(name) ?? new Map<string, Set<string>>();
      const viaSet = versions.get(version) ?? new Set<string>();

      // A workspace member is what a person fixes; a store package is only named when no member resolves it.
      if (member) {
        viaSet.add(via);
      }

      versions.set(version, viaSet);
      seen.set(name, versions);

      // A store entry sits at <store>/node_modules/@venizia/<name>: the folder it came from is the
      // scope its own dependencies are linked in. A workspace member is a root of its own.
      const home = join(real, '..');

      if (real.includes(`${sep}node_modules${sep}`) && !visited.has(home)) {
        visited.add(home);
        queue.push({ directory: join(home, '..', '..'), via: `${name}@${version}`, member: false });
      }
    }
  }

  return [...seen.entries()]
    .filter(([, versions]) => versions.size > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([name, versions]) =>
        `${name} - ${[...versions.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(
            ([version, via]) =>
              `${version} (${via.size > 0 ? [...via].sort().join(', ') : 'through another package'})`,
          )
          .join(' | ')}`,
    );
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

export const fetchDistTags = async (opts: { name: string }): Promise<IDistTags> => {
  const response = await fetch(`${REGISTRY}/-/package/${opts.name.replace('/', '%2F')}/dist-tags`);

  if (!response.ok) {
    return { name: opts.name };
  }

  const body: unknown = await response.json();
  const tags = toStringRecord(body);

  return { name: opts.name, latest: tags.latest, next: tags.next, highest: tags.highest };
};

/**
 * `highest` is the newest version of a package whatever its dist-tag, and it only goes up: a stable
 * `0.4.9` published after `0.4.10-0` must not pull it down. No `highest` yet means it is set.
 */
export const shouldMoveHighest = (opts: {
  published: string;
  current: string | undefined;
}): boolean => opts.current === undefined || Bun.semver.order(opts.published, opts.current) > 0;

/**
 * A stable ships on IGNIS stable: every `@venizia/*` range that is not one of this repository's own
 * (`@venizia/ardor*`) must be free of a prerelease part. Returns `name@range` for each that is not.
 */
export const prereleaseRanges = (opts: { manifest: Record<string, unknown> }): string[] =>
  RANGE_SECTIONS.flatMap((section) =>
    Object.entries(toStringRecord(opts.manifest[section])).filter(
      ([name, range]) =>
        name.startsWith('@venizia/') &&
        !name.startsWith(SIBLING_PREFIX) &&
        /\d+\.\d+\.\d+-/.test(range),
    ),
  ).map(([name, range]) => `${name}@${range}`);

/**
 * The files that name packages: the file itself, or every `preset.json` under a folder. A preset's
 * `files/` folder holds templates (a `tsconfig.json` with comments), which are not manifests.
 */
const presetFilesUnder = (opts: { path: string }): string[] =>
  readdirSync(opts.path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? presetFilesUnder({ path: join(opts.path, entry.name) })
      : entry.name === 'preset.json'
        ? [join(opts.path, entry.name)]
        : [],
  );

const manifestFilesOf = (opts: { path: string }): string[] =>
  statSync(opts.path).isDirectory() ? presetFilesUnder({ path: opts.path }) : [opts.path];

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
          ...missing.map((file) => `  ${file}`),
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
          ...strays.map((stray) => `  ${stray}`),
          'Raise the range so it covers the version in packages/, then re-run.',
        ],
      });
    }

    console.log('    ✓ every ARDOR sibling links to the workspace');
    return;
  }

  if (command === 'single-copy') {
    const copies = duplicateCopies({ root: first ?? root });

    if (copies.length > 0) {
      fail({
        lines: [
          'ERROR: a @venizia/* package resolves to more than one version:',
          ...copies.map((copy) => `  ${copy}`),
          'Declare the package as a catalog: devDependency in the workspace member that resolves the older copy.',
        ],
      });
    }

    console.log('    ✓ every @venizia/* package resolves to one version');
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
          ...found.map((entry) => `  ${entry}`),
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
          ...missing.map((entry) => `  - ${entry}`),
        ],
      });
    }

    console.log(
      `    ✓ all ${Object.keys(dependencies).length} runtime dependencies resolve on the registry`,
    );
    return;
  }

  if (command === 'stable-deps' && first !== undefined) {
    const found = manifestFilesOf({ path: first }).flatMap((path) =>
      prereleaseRanges({ manifest: readJson({ path }) }).map((entry) => `${path}: ${entry}`),
    );

    if (found.length > 0) {
      fail({
        lines: [
          'ERROR: a stable must not ship an IGNIS prerelease:',
          ...found.map((entry) => `  ${entry}`),
          'Publish the IGNIS stable first, then dispatch again.',
        ],
      });
    }

    console.log('    ✓ no @venizia/* range asks for a prerelease');
    return;
  }

  if (command === 'tag-highest') {
    const args = Bun.argv.slice(3);
    const value = readFlag({ argv: args, flag: '--published' }) ?? '';
    const at = value.lastIndexOf('@');
    const name = at > 0 ? value.slice(0, at) : '';
    const version = at > 0 ? value.slice(at + 1) : '';

    if (name === '' || !isReleaseVersion({ value: version })) {
      throw new Error(
        `[tag-highest] --published '${value}' is not <name>@<version> with a semver version`,
      );
    }

    const { highest } = await fetchDistTags({ name });

    if (!shouldMoveHighest({ published: version, current: highest })) {
      console.log(`    ✓ highest stays at ${highest ?? '-'} (${version} is not above it)`);
      return;
    }

    const moved = Bun.spawnSync(
      args.includes('--dry-run')
        ? ['echo', 'dry run:', 'npm', 'dist-tag', 'add', `${name}@${version}`, 'highest']
        : ['npm', 'dist-tag', 'add', `${name}@${version}`, 'highest'],
      { stdout: 'pipe', stderr: 'pipe' },
    );

    if (moved.exitCode !== 0) {
      fail({
        lines: [`ERROR: could not move highest of ${name} to ${version}`, moved.stderr.toString()],
      });
    }

    console.log(`    ✓ highest of ${name} moved from ${highest ?? '-'} to ${version}`);
    return;
  }

  if (command === 'heal-next') {
    const args = Bun.argv.slice(3);
    const dryRun = args.includes('--dry-run');
    const published = parsePublished({ argv: args });
    const names = [...readWorkspaceVersions({ root }).keys()]
      .filter((name) => name.startsWith(SIBLING_PREFIX))
      .sort();
    const registry = await Promise.all(names.map((name) => fetchDistTags({ name })));
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
    '[release-gates] use: artifacts <dir> | links <dir> | pack <dir> <out> | protocols <file> | registry <file> [--chain-released a,b] | stable-deps <path> | tag-highest --published <name>@<version> | heal-next [--dry-run]',
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
