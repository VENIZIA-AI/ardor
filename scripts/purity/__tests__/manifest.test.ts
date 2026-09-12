import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertNoWorkspaceExternal, deriveEntries, PURITY_MANIFEST } from '../manifest';
import type { IPurityEntry } from '../manifest';

const REPOSITORY_ROOT = join(__dirname, '../../..');

const readPublishedTargets = (opts: { package: string }): string[] => {
  const manifestPath = join(REPOSITORY_ROOT, 'packages', opts.package, 'package.json');
  const exportsMap = (
    JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      exports: Record<string, string | Record<string, string>>;
    }
  ).exports;

  const targets: string[] = [];

  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (subpath === './package.json') {
      continue;
    }

    const files =
      typeof target === 'string'
        ? [target]
        : Object.entries(target)
            .filter(([condition]) => condition !== 'types')
            .map(([, file]) => file);

    for (const file of files) {
      targets.push(join('packages', opts.package, file));
    }
  }

  return [...new Set(targets)];
};

describe('assertNoWorkspaceExternal', () => {
  test('the real manifest passes - nothing externalises a workspace package', () => {
    expect(() => assertNoWorkspaceExternal(PURITY_MANIFEST)).not.toThrow();
  });

  // The motivating case: this is exactly the escape hatch that would silently hide a real
  // root-barrel leak (like the one this task fixed) by removing it from the module graph.
  test('rejects an entry that externalises an ARDOR workspace package', () => {
    const poisoned: IPurityEntry[] = [
      {
        label: 'poisoned',
        package: 'admin',
        entry: 'irrelevant.js',
        external: ['@venizia/ardor-kernel'],
      },
    ];

    expect(() => assertNoWorkspaceExternal(poisoned)).toThrow(/workspace package/);
    expect(() => assertNoWorkspaceExternal(poisoned)).toThrow(/poisoned/);
    expect(() => assertNoWorkspaceExternal(poisoned)).toThrow(/@venizia\/ardor-kernel/);
  });

  test('does not reject a third-party external', () => {
    const clean: IPurityEntry[] = [
      {
        label: 'clean',
        package: 'admin',
        entry: 'irrelevant.js',
        external: ['@electric-sql/pglite'],
      },
    ];

    expect(() => assertNoWorkspaceExternal(clean)).not.toThrow();
  });

  test('rejects a workspace package buried behind an earlier third-party entry', () => {
    const mixed: IPurityEntry[] = [
      {
        label: 'mixed',
        package: 'admin',
        entry: 'irrelevant.js',
        external: ['@electric-sql/pglite', '@venizia/ignis-kernel'],
      },
    ];

    expect(() => assertNoWorkspaceExternal(mixed)).toThrow(/@venizia\/ignis-kernel/);
  });
});

/**
 * The defect these cover (inherited from IGNIS, where a hand-written manifest reported 11/11 while
 * most published sub-paths were never probed): a count is not the property that matters; COVERAGE
 * of the published surface is. Every ARDOR runtime package publishes one root entry today; a
 * sub-path added later must appear here or the derivation fails.
 */
describe('PURITY_MANIFEST derivation', () => {
  const claimedPackages = [...new Set(PURITY_MANIFEST.map(row => row.package))];

  const fullSurfacePackages = claimedPackages;

  test.each(fullSurfacePackages)(
    'every entry point %s publishes has a row',
    (packageName: string) => {
      const probed = new Set(
        PURITY_MANIFEST.filter(row => row.package === packageName).map(row => row.entry),
      );

      for (const target of readPublishedTargets({ package: packageName })) {
        expect(probed).toContain(target);
      }
    },
  );

  test('every runtime package claims its single ESM root entry', () => {
    const entries = PURITY_MANIFEST.map(row => row.entry).toSorted();

    // ARDOR ships one ESM build per package; every runtime package is a browser library, so every
    // root entry is claimed - a package added without a claim is a gate hole, not a default.
    expect(entries).toEqual([
      'packages/admin/dist/index.js',
      'packages/ardor/dist/index.js',
      'packages/kernel/dist/index.js',
      'packages/react/dist/index.js',
    ]);
  });

  test('a claimed sub-path that the exports map no longer publishes fails the derivation', () => {
    expect(() => deriveEntries({ package: 'kernel', subpaths: ['./renamed-away'] })).toThrow(
      /no longer\s+publishes/,
    );
  });

  test('an external declared for a sub-path that is gone fails the derivation', () => {
    expect(() =>
      deriveEntries({ package: 'admin', external: { './renamed-away': ['ra-core'] } }),
    ).toThrow(/no longer\s+publishes/);
  });

  test('a single-build package yields exactly one row, deduping the default condition', () => {
    const labels = PURITY_MANIFEST.filter(row => row.package === 'kernel').map(row => row.label);

    // `exports['.']` names import AND default; default repeats import's file, so one build and no suffix.
    expect(labels).toEqual(['kernel']);
  });
});
