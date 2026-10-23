/**
 * Rewrites every `@venizia/*` entry of the root `workspaces.catalog` to the registry's `highest`
 * dist-tag (prerelease included). ARDOR tracks the highest published IGNIS line, never `latest`:
 * a feature shipped on the prerelease line is what the framework builds on.
 *
 * `force-update.sh` inside a package deliberately skips catalogued ranges, so the catalog is the
 * only place these versions live - this script is what refreshes it.
 *
 * Usage: bun scripts/refresh-catalog.ts [highest|next|latest]   (default: highest)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const MANIFEST = resolve(ROOT, 'package.json');
const TAG = process.argv[2] ?? 'highest';

if (!['highest', 'next', 'latest'].includes(TAG)) {
  console.error(`refresh-catalog: unknown tag "${TAG}" (highest | next | latest)`);
  process.exit(1);
}

type TManifest = { workspaces: { catalog: Record<string, string> } };

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as TManifest;
const catalog = manifest.workspaces.catalog;
const changes: string[] = [];

for (const name of Object.keys(catalog).filter(key => key.startsWith('@venizia/'))) {
  const proc = Bun.spawnSync(['npm', 'view', name, `dist-tags.${TAG}`], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const version = new TextDecoder().decode(proc.stdout).trim();
  if (proc.exitCode !== 0 || version.length === 0) {
    console.error(`[${name}] no "${TAG}" dist-tag on the registry - left at ${catalog[name]}`);
    continue;
  }
  const range = `^${version}`;
  if (catalog[name] !== range) {
    changes.push(`${name}: ${catalog[name]} -> ${range}`);
    catalog[name] = range;
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  changes.length === 0
    ? `refresh-catalog: every @venizia/* entry already at ${TAG}`
    : `refresh-catalog: ${changes.length} entr${changes.length === 1 ? 'y' : 'ies'} moved to ${TAG}\n  ${changes.join('\n  ')}`,
);

export {};
