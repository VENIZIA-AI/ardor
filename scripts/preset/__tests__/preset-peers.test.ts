import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { manifestFilesOf, prereleaseRanges } from '../../release/release-gates';

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
  // The files the stable run's `stable-deps` reads: every preset.json under presets/, nested ones too.
  const manifests = manifestFilesOf({ path: join(ROOT, 'presets') }).map((file) =>
    relative(ROOT, file),
  );

  test('the check sees a prerelease token in a hand-written peer, so it is not vacuous', () => {
    const manifest = { peers: { '@venizia/dev-configs': '^0.4.0 || ^0.4.7-2' } };

    expect(prereleaseRanges({ manifest })).toEqual(['@venizia/dev-configs@^0.4.0 || ^0.4.7-2']);
  });

  test('it finds the manifests of both presets', () => {
    expect(manifests).toContain('presets/app/preset.json');
    expect(manifests).toContain('presets/lib/preset.json');
  });

  describe.skipIf(!catalogIsStable)('while the catalog pins only stable versions', () => {
    test.each(manifests)('%s names no prerelease', (file) => {
      expect(prereleaseRanges({ manifest: readJson(file) })).toEqual([]);
    });
  });
});
