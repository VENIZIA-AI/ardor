import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { findCatalogProblems } from '@venizia/dev-configs/checks';

import { makeScratch } from '../../scratch';

const roots: string[] = [];

const makeRoot = (opts: { files: Record<string, unknown> }): string => {
  const root = makeScratch({ prefix: 'ardor-catalog-' });
  roots.push(root);

  for (const [path, content] of Object.entries(opts.files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(content));
  }

  return root;
};

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const ROOT_MANIFEST = { name: 'workspace', workspaces: { catalog: { react: '^19.0.0' } } };

/** The gate `make catalog-check` runs, on a fixture: the positive controls must fail the same way. */
describe('findCatalogProblems', () => {
  test('passes a manifest that references the catalog', async () => {
    const root = makeRoot({
      files: {
        'package.json': ROOT_MANIFEST,
        'packages/a/package.json': { name: 'a', devDependencies: { react: 'catalog:' } },
      },
    });

    const report = await findCatalogProblems({ root });

    expect(report.problems).toEqual([]);
    expect(report.referenced).toBe(1);
  });

  test('fails a catalogued dependency that carries its own range', async () => {
    const root = makeRoot({
      files: {
        'package.json': ROOT_MANIFEST,
        'packages/a/package.json': { name: 'a', devDependencies: { react: '^18.0.0' } },
      },
    });

    const report = await findCatalogProblems({ root });

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]?.file).toBe('packages/a/package.json');
  });

  test('allows catalog: in a preset peer, and fails it in a package peer', async () => {
    const files = {
      'package.json': ROOT_MANIFEST,
      'packages/a/package.json': {
        name: 'a',
        devDependencies: { react: 'catalog:' },
        peerDependencies: { react: 'catalog:' },
      },
      'presets/lib/preset.json': { peerDependencies: { react: 'catalog:' } },
    };
    const root = makeRoot({ files });

    const report = await findCatalogProblems({
      root,
      globs: ['presets/*/preset.json'],
      presetPrefix: 'presets/',
    });

    expect(report.problems.map((problem) => problem.file)).toEqual(['packages/a/package.json']);
  });
});
