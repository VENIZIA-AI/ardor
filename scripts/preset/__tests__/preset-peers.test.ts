import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { prereleaseRanges } from '../../release/release-gates';

const ROOT = resolve(import.meta.dir, '..', '..', '..');

const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

// A peer range the app preset writes by hand (not a `peer:` marker) never moves with a release. A caret
// range such as ^0.4.0 meets no prerelease, so `vulcan add` refuses an IGNIS app whose catalog pins
// dev-configs 0.4.7-3, and the pair smoke of the release 0.4.7-1 failed on it (#504).
describe('presets/app/preset.json, the peers written by hand', () => {
  const peers: Record<string, string> = readJson('presets/app/preset.json').peers;
  const catalog: Record<string, string> = readJson('package.json').workspaces.catalog;
  const literal = Object.entries(peers).filter(([, range]) => !range.endsWith(':'));

  test('there is at least one, so this test is not vacuous', () => {
    expect(literal.length).toBeGreaterThan(0);
  });

  test.each(literal)('%s %s admits the version the root catalog pins', (name, range) => {
    const pinned = catalog[name]?.replace(/^[\^~]/, '');

    expect(pinned).toBeDefined();
    expect(Bun.semver.satisfies(pinned as string, range)).toBe(true);
  });

  test.each(literal)('%s %s admits a later prerelease of the same line', (name, range) => {
    const pinned = (catalog[name] ?? '').replace(/^[\^~]/, '');
    const [core = '', pre = ''] = pinned.split('-');
    const next = pre === '' ? undefined : `${core}-${Number.parseInt(pre, 10) + 2}`;

    if (next === undefined) {
      return;
    }

    expect(Bun.semver.satisfies(next, range)).toBe(true);
  });
});

// A stable ships on stable ranges: the stable run stops at its preset check if a preset names a
// prerelease (0.4.7 stopped on a hand-written dev-configs peer, #549). The check is the run's own
// (`prereleaseRanges`), applied to the sources on every pull request, but only while the root catalog
// pins no prerelease: a prerelease cycle needs the hand-written peers to name the prerelease line (#504).
describe('presets/*/preset.json, a stable ships on stable ranges', () => {
  const catalog: Record<string, string> = readJson('package.json').workspaces.catalog;
  const catalogIsStable = Object.entries(catalog)
    .filter(([name]) => name.startsWith('@venizia/'))
    .every(([, range]) => !/\d+\.\d+\.\d+-/.test(range));
  const presets = readdirSync(join(ROOT, 'presets'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  test('the check sees a prerelease token in a hand-written peer, so it is not vacuous', () => {
    const manifest = { peers: { '@venizia/dev-configs': '^0.4.0 || ^0.4.7-2' } };

    expect(prereleaseRanges({ manifest })).toEqual(['@venizia/dev-configs@^0.4.0 || ^0.4.7-2']);
  });

  test.each(presets)(
    'presets/%s names no prerelease while the catalog pins only stable versions',
    (name) => {
      if (!catalogIsStable) {
        return;
      }

      expect(prereleaseRanges({ manifest: readJson(`presets/${name}/preset.json`) })).toEqual([]);
    },
  );
});
