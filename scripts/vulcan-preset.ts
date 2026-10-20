/**
 * Writes the publishable copy of a package's VULCAN preset. The template in `presets/<name>/` (a
 * sibling of `packages/`) marks what a release must fill in; the copy in the package's
 * `dist/vulcan-preset/` carries the real versions, so a preset always describes the release it ships in.
 *
 *   workspace:*  the exact version of that workspace package, read from its package.json now
 *   catalog:     the range in the root catalog; a @venizia package is exact (a leading ^ or ~ is dropped)
 *   peer:        the range this package's own peerDependencies hold for that name
 *
 * Usage: bun scripts/vulcan-preset.ts   (writes packages/ardor/dist/vulcan-preset/app)
 */
import { Glob } from 'bun';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SECTIONS = ['dependencies', 'devDependencies', 'peers'] as const;
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
  /** The preset template (`preset.json` and `files/`), relative to `root`. */
  presetDirectory: string;
  outDirectory: string;
}): IBuildPresetResult => {
  const { root, outDirectory } = opts;
  const packageRoot = join(root, opts.packageDirectory);
  const presetRoot = join(root, opts.presetDirectory);
  const manifest = readJson({ path: join(root, 'package.json') });
  const catalog = readCatalog({ manifest });
  const versions = readWorkspaceVersions({ root, manifest });
  const peers = toStringRecord({
    value: readJson({ path: join(packageRoot, 'package.json') }).peerDependencies,
  });
  const template = readJson({ path: join(presetRoot, 'preset.json') });
  const resolved = new Set<string>();

  const resolveRange = (entry: { name: string; range: string }): string => {
    const { name, range } = entry;
    let value: string | undefined;

    if (range === 'workspace:*') {
      value = versions.get(name);
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
      throw new Error(`[buildPreset] ${name} | cannot resolve "${range}" in ${presetRoot}`);
    }

    resolved.add(`${name} -> ${value}`);

    return value;
  };

  const output: TRecord = { ...template, files: './files' };

  for (const section of SECTIONS) {
    output[section] = Object.fromEntries(
      Object.entries(toStringRecord({ value: template[section] })).map(([name, range]) => [
        name,
        resolveRange({ name, range }),
      ]),
    );
  }

  rmSync(outDirectory, { recursive: true, force: true });
  mkdirSync(outDirectory, { recursive: true });
  cpSync(join(presetRoot, 'files'), join(outDirectory, 'files'), { recursive: true });
  writeFileSync(join(outDirectory, 'preset.json'), `${JSON.stringify(output, null, 2)}\n`);

  return { resolved: [...resolved].sort() };
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..');
  const { resolved } = buildPreset({
    root,
    packageDirectory: 'packages/ardor',
    presetDirectory: 'presets/app',
    outDirectory: join(root, 'packages/ardor/dist/vulcan-preset/app'),
  });

  console.log(resolved.join('\n'));
  console.log(
    `vulcan-preset: wrote packages/ardor/dist/vulcan-preset/app (${resolved.length} resolved)`,
  );
}
