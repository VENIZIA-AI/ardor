import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertNoWorkspaceExternal, deriveEntries, PURITY_MANIFEST } from '../manifest';
import type { IPurityEntry } from '../manifest';

const REPOSITORY_ROOT = join(__dirname, '../../../..');

/** Entries that run in Node, in the build of an app: they carry no browser claim, and nothing else is exempt. */
const NODE_ONLY_ENTRIES = ['packages/ardor/dist/vite/index.js'];

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
  const claimedPackages = [...new Set(PURITY_MANIFEST.map((row) => row.package))];

  const fullSurfacePackages = claimedPackages;

  test.each(fullSurfacePackages)(
    'every entry point %s publishes has a row',
    (packageName: string) => {
      const probed = new Set(
        PURITY_MANIFEST.filter((row) => row.package === packageName).map((row) => row.entry),
      );

      for (const target of readPublishedTargets({ package: packageName })) {
        if (!NODE_ONLY_ENTRIES.includes(target)) {
          expect(probed).toContain(target);
        }
      }
    },
  );

  test('only the listed Node-only entries are published without a row', () => {
    const probed = new Set(PURITY_MANIFEST.map((row) => row.entry));
    const unclaimed = claimedPackages
      .flatMap((packageName) => readPublishedTargets({ package: packageName }))
      .filter((target) => !probed.has(target));

    expect(unclaimed.toSorted()).toEqual(NODE_ONLY_ENTRIES);
  });

  test('every published entry is claimed, root and optional sub-path alike', () => {
    const entries = PURITY_MANIFEST.map((row) => row.entry).toSorted();

    // Every runtime package is a browser library, so every entry it publishes is claimed - one
    // added without a claim is a gate hole, not a default. The repository sub-path sits on its
    // own for weight - it pulls the IGNIS repository runtime, which is larger than the whole kernel
    // budget.
    expect(entries).toEqual([
      'packages/admin/dist/index.js',
      'packages/ardor/dist/index.js',
      'packages/ardor/dist/repository.js',
      'packages/ardor/dist/testing.js',
      'packages/kernel/dist/base/repositories/index.js',
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
    const labels = PURITY_MANIFEST.filter((row) => row.package === 'kernel').map(
      (row) => row.label,
    );

    // Each condition set names import AND default; default repeats the import file, so every
    // entry yields ONE row - the root without a suffix, each sub-path labelled by its own.
    expect(labels).toEqual(['kernel', 'kernel/repository']);
  });
});
