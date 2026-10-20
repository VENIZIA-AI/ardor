import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildPreset } from '../vulcan-preset';

const roots: string[] = [];

const write = (root: string, path: string, content: string | Uint8Array) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
};

type TTemplate = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peers?: Record<string, string>;
};

/** A repository: root catalog, workspace `@venizia/a`, the preset package `@venizia/umbrella`. */
const repository = (opts: { template?: TTemplate; catalog?: Record<string, string> }): string => {
  const root = mkdtempSync(join(tmpdir(), 'vulcan-preset-'));
  roots.push(root);
  write(
    root,
    'package.json',
    JSON.stringify({
      workspaces: {
        packages: ['packages/*'],
        catalog: opts.catalog ?? { react: '^19.2.7', '@venizia/ignis-kernel': '^0.2.2' },
      },
    }),
  );
  write(root, 'packages/a/package.json', JSON.stringify({ name: '@venizia/a', version: '1.2.3' }));
  write(
    root,
    'packages/umbrella/package.json',
    JSON.stringify({
      name: '@venizia/umbrella',
      version: '4.5.6',
      peerDependencies: { '@venizia/ignis-kernel': '^0.2.2' },
    }),
  );
  write(
    root,
    'packages/umbrella/vulcan-preset/preset.json',
    JSON.stringify({
      presetVersion: 1,
      side: 'frontend',
      summary: 'x',
      devPort: 5173,
      scripts: {},
      checks: [],
      files: './files',
      atlas: [],
      ...opts.template,
    }),
  );
  write(root, 'packages/umbrella/vulcan-preset/files/_env.example', 'PORT={{devPort}}\n');
  write(root, 'packages/umbrella/vulcan-preset/files/.configs/lint.mts', 'export {};\n');
  write(root, 'packages/umbrella/vulcan-preset/files/logo.bin', new Uint8Array([0, 255, 1, 2]));

  return root;
};

const build = (root: string) =>
  buildPreset({
    root,
    packageDirectory: 'packages/umbrella',
    outDirectory: join(root, 'packages/umbrella/dist/vulcan-preset'),
  });

const output = (root: string): Record<string, Record<string, string>> =>
  JSON.parse(readFileSync(join(root, 'packages/umbrella/dist/vulcan-preset/preset.json'), 'utf8'));

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('buildPreset', () => {
  test('workspace:* becomes the exact version on disk, read at call time', () => {
    const root = repository({ template: { dependencies: { '@venizia/a': 'workspace:*' } } });
    build(root);
    expect(output(root).dependencies?.['@venizia/a']).toBe('1.2.3');

    write(
      root,
      'packages/a/package.json',
      JSON.stringify({ name: '@venizia/a', version: '1.2.4' }),
    );
    build(root);
    expect(output(root).dependencies?.['@venizia/a']).toBe('1.2.4');
  });

  test('catalog: becomes the catalog range, exact for a @venizia package', () => {
    const root = repository({
      template: {
        dependencies: { react: 'catalog:' },
        devDependencies: { '@venizia/ignis-kernel': 'catalog:' },
      },
    });
    build(root);
    expect(output(root).dependencies?.react).toBe('^19.2.7');
    expect(output(root).devDependencies?.['@venizia/ignis-kernel']).toBe('0.2.2');
  });

  test('catalog: is read from a top-level catalog too', () => {
    const root = repository({ template: { dependencies: { react: 'catalog:' } } });
    write(
      root,
      'package.json',
      JSON.stringify({ workspaces: ['packages/*'], catalog: { react: '^18.0.0' } }),
    );
    build(root);
    expect(output(root).dependencies?.react).toBe('^18.0.0');
  });

  test('peer: becomes the range the preset package peers on', () => {
    const root = repository({ template: { peers: { '@venizia/ignis-kernel': 'peer:' } } });
    build(root);
    expect(output(root).peers?.['@venizia/ignis-kernel']).toBe('^0.2.2');
  });

  test('a literal range passes through unchanged', () => {
    const root = repository({ template: { dependencies: { winston: '^3.19.0' } } });
    build(root);
    expect(output(root).dependencies?.winston).toBe('^3.19.0');
  });

  test('a catalog: name missing from the catalog throws, naming it', () => {
    const root = repository({ template: { dependencies: { lodash: 'catalog:' } } });
    expect(() => build(root)).toThrow('lodash');
  });

  test('a workspace:* name with no workspace package throws, naming it', () => {
    const root = repository({ template: { dependencies: { '@venizia/ghost': 'workspace:*' } } });
    expect(() => build(root)).toThrow('@venizia/ghost');
  });

  test('a peer: name the package does not peer on throws, naming it', () => {
    const root = repository({ template: { peers: { '@venizia/ignis-filter': 'peer:' } } });
    expect(() => build(root)).toThrow('@venizia/ignis-filter');
  });

  test('files are copied byte-identical, dotfile folders included, and preset.json points at them', () => {
    const root = repository({});
    build(root);
    const out = join(root, 'packages/umbrella/dist/vulcan-preset');
    expect(readFileSync(join(out, 'files/_env.example'), 'utf8')).toBe('PORT={{devPort}}\n');
    expect(readFileSync(join(out, 'files/.configs/lint.mts'), 'utf8')).toBe('export {};\n');
    expect([...readFileSync(join(out, 'files/logo.bin'))]).toEqual([0, 255, 1, 2]);
    expect(JSON.parse(readFileSync(join(out, 'preset.json'), 'utf8')).files).toBe('./files');
  });

  test('the output folder is replaced, not merged', () => {
    const root = repository({});
    const stale = join(root, 'packages/umbrella/dist/vulcan-preset/files/stale.txt');
    write(root, 'packages/umbrella/dist/vulcan-preset/files/stale.txt', 'old');
    build(root);
    expect(existsSync(stale)).toBe(false);
  });

  test('it reports one line per resolved dependency', () => {
    const root = repository({
      template: { dependencies: { react: 'catalog:', '@venizia/a': 'workspace:*' } },
    });
    expect(build(root).resolved).toEqual(['@venizia/a -> 1.2.3', 'react -> ^19.2.7']);
  });
});
