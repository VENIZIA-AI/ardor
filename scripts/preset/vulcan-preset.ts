/**
 * Writes the publishable copy of a package's VULCAN presets. The templates in `presets/app/` and
 * `presets/lib/` (a sibling of `packages/`, each `preset.json` and `files/`) mark what a release must
 * fill in; the copies in the package's `dist/presets/app/` and `lib/` carry the real versions, so a
 * preset always describes the release it ships in. The lib also gets the app's lint and format configs.
 *
 *   workspace:*  the exact version of that workspace package, read from its package.json now
 *   workspace:^  the same version behind a caret, for a peer range
 *   catalog:     the range in the root catalog; a @venizia package is exact (a leading ^ or ~ is dropped)
 *   peer:        the range this package's own peerDependencies hold for that name
 *
 * Usage: bun scripts/preset/vulcan-preset.ts   (writes packages/ardor/dist/presets/{app,lib})
 */
import { Glob } from 'bun';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The blocks of a template that name packages; a block a template does not have is not written. */
const SECTIONS = ['dependencies', 'devDependencies', 'peers', 'peerDependencies'] as const;
const KINDS = ['app', 'lib'] as const;
/** What a lib shares with the app: the lint and format configs. A lib's own file of the same path wins. */
const LIB_SHARED = ['.configs/lints', '.configs/formatters'];
const EXACT_SCOPE = '@venizia/';
const RANGE_PREFIX = /^[\^~]/;

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = (opts: { path: string }): TRecord => {
  const value: unknown = JSON.parse(readFileSync(opts.path, 'utf8'));

  if (!isRecord(value)) {
    throw new Error(`[readJson] ${opts.path} | expected a JSON object`);
  }

  return value;
};

const toStringRecord = (opts: { value: unknown }): Record<string, string> =>
  isRecord(opts.value)
    ? Object.fromEntries(
        Object.entries(opts.value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};

const readCatalog = (opts: { manifest: TRecord }): Record<string, string> => ({
  ...(isRecord(opts.manifest.workspaces)
    ? toStringRecord({ value: opts.manifest.workspaces.catalog })
    : {}),
  ...toStringRecord({ value: opts.manifest.catalog }),
});

/** Name to version of every workspace package, read from disk at call time. */
const readWorkspaceVersions = (opts: { root: string; manifest: TRecord }): Map<string, string> => {
  const { workspaces } = opts.manifest;
  const patterns = Array.isArray(workspaces)
    ? workspaces
    : isRecord(workspaces) && Array.isArray(workspaces.packages)
      ? workspaces.packages
      : [];
  const versions = new Map<string, string>();

  for (const pattern of patterns) {
    for (const file of new Glob(`${String(pattern)}/package.json`).scanSync({ cwd: opts.root })) {
      const { name, version } = readJson({ path: join(opts.root, file) });

      if (typeof name === 'string' && typeof version === 'string') {
        versions.set(name, version);
      }
    }
  }

  return versions;
};

export interface IBuildPresetResult {
  /** One `name -> value` line per marker that was resolved, sorted. */
  resolved: string[];
}

export const buildPreset = (opts: {
  root: string;
  /** The package the preset is published in, relative to `root`: its peerDependencies fill `peer:`. */
  packageDirectory: string;
  /** The folder of the templates, relative to `root`: `app/` and `lib/`, each `preset.json` and `files/`. */
  presetsDirectory: string;
  /** Where `app/` and `lib/` are written. */
  outDirectory: string;
}): IBuildPresetResult => {
  const { root, outDirectory } = opts;
  const packageRoot = join(root, opts.packageDirectory);
  const presetsRoot = join(root, opts.presetsDirectory);
  const manifest = readJson({ path: join(root, 'package.json') });
  const catalog = readCatalog({ manifest });
  const versions = readWorkspaceVersions({ root, manifest });
  const peers = toStringRecord({
    value: readJson({ path: join(packageRoot, 'package.json') }).peerDependencies,
  });
  const resolved = new Set<string>();

  const resolveRange = (entry: { name: string; range: string }): string => {
    const { name, range } = entry;
    let value: string | undefined;

    if (range === 'workspace:*') {
      value = versions.get(name);
    } else if (range === 'workspace:^') {
      const version = versions.get(name);

      value = version === undefined ? undefined : `^${version}`;
    } else if (range === 'catalog:') {
      const pinned = catalog[name];

      value =
        pinned !== undefined && name.startsWith(EXACT_SCOPE)
          ? pinned.replace(RANGE_PREFIX, '')
          : pinned;
    } else if (range === 'peer:') {
      value = peers[name];
    } else {
      return range;
    }

    if (value === undefined) {
      throw new Error(`[buildPreset] ${name} | cannot resolve "${range}" in ${presetsRoot}`);
    }

    resolved.add(`${name} -> ${value}`);

    return value;
  };

  rmSync(outDirectory, { recursive: true, force: true });

  for (const kind of KINDS) {
    const kindRoot = join(presetsRoot, kind);

    if (!existsSync(join(kindRoot, 'preset.json'))) {
      continue;
    }

    const template = readJson({ path: join(kindRoot, 'preset.json') });
    const output: TRecord = { ...template, files: './files' };

    for (const section of SECTIONS) {
      if (template[section] === undefined && !(kind === 'app' && section !== 'peerDependencies')) {
        continue;
      }

      output[section] = Object.fromEntries(
        Object.entries(toStringRecord({ value: template[section] })).map(([name, range]) => [
          name,
          resolveRange({ name, range }),
        ]),
      );
    }

    const kindOut = join(outDirectory, kind);

    mkdirSync(kindOut, { recursive: true });

    if (kind === 'lib') {
      for (const path of LIB_SHARED) {
        const source = join(presetsRoot, 'app', 'files', path);

        if (existsSync(source)) {
          cpSync(source, join(kindOut, 'files', path), { recursive: true });
        }
      }
    }

    cpSync(join(kindRoot, 'files'), join(kindOut, 'files'), { recursive: true });
    writeFileSync(join(kindOut, 'preset.json'), `${JSON.stringify(output, null, 2)}\n`);
  }

  return { resolved: [...resolved].sort() };
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..', '..');
  const { resolved } = buildPreset({
    root,
    packageDirectory: 'packages/ardor',
    presetsDirectory: 'presets',
    outDirectory: join(root, 'packages/ardor/dist/presets'),
  });

  console.log(resolved.join('\n'));
  console.log(`vulcan-preset: wrote packages/ardor/dist/presets (${resolved.length} resolved)`);
}
