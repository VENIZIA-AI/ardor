import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeScratch } from '../../scratch';
import { DeclaredImports } from '../declared-imports';

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** An app folder with a package.json and `files`. */
const createApp = (opts: { manifest: Record<string, unknown>; files: Record<string, string> }) => {
  const folder = makeScratch({ prefix: 'declared-imports-' });

  roots.push(folder);
  writeFileSync(join(folder, 'package.json'), JSON.stringify(opts.manifest));

  for (const [path, content] of Object.entries(opts.files)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), content);
  }

  return folder;
};

describe('DeclaredImports.packageOf', () => {
  test.each([
    ['react', 'react'],
    ['react-dom/client', 'react-dom'],
    ['@venizia/ardor', '@venizia/ardor'],
    ['@venizia/ardor/repository', '@venizia/ardor'],
    ['@tanstack/react-query', '@tanstack/react-query'],
  ])('%s names the package %s', (specifier, name) => {
    expect(DeclaredImports.packageOf({ specifier })).toBe(name);
  });

  test.each([
    './local',
    '../up',
    '/absolute',
    '#src/main',
    'node:fs',
    'fs',
    'fs/promises',
    'bun',
    'bun:test',
    'virtual:pwa',
    '',
  ])('%s is no package a manifest declares', (specifier) => {
    expect(DeclaredImports.packageOf({ specifier })).toBeNull();
  });
});

describe('DeclaredImports.undeclared', () => {
  test('an app that declares everything it imports has nothing undeclared', () => {
    const folder = createApp({
      manifest: {
        name: 'app',
        dependencies: { react: '1' },
        devDependencies: { vite: '1' },
        peerDependencies: { '@venizia/ardor': '1' },
        optionalDependencies: { sharp: '1' },
      },
      files: {
        'src/main.tsx':
          "import React from 'react';\nimport { Ardor } from '@venizia/ardor/repository';\nimport s from 'sharp';\nimport { x } from './x';\nimport { y } from '#src/y';\nimport fs from 'node:fs';\n",
        'vite.config.mts':
          "import { defineConfig } from 'vite';\nexport default defineConfig({});\n",
      },
    });

    expect(DeclaredImports.undeclared({ folder })).toEqual([]);
  });

  test('an import the manifest does not declare is named with the file that has it', () => {
    const folder = createApp({
      manifest: { name: 'app', dependencies: { react: '1' } },
      files: {
        'src/a.ts': "import 'react';\nimport _ from 'lodash/fp';\n",
        'src/deep/b.ts': "import _ from 'lodash';\nimport { q } from '@tanstack/react-query';\n",
      },
    });

    expect(DeclaredImports.undeclared({ folder })).toEqual([
      '@tanstack/react-query (src/deep/b.ts)',
      'lodash (src/a.ts)',
    ]);
  });

  test('it finds a dynamic import, a require, a re-export and a config file in a dot folder', () => {
    const folder = createApp({
      manifest: { name: 'app' },
      files: {
        'src/a.ts': "export const load = () => import('dyn-pkg');\n",
        'src/b.cjs': "const r = require('req-pkg');\n",
        'src/c.ts': "export * from 'reexport-pkg';\n",
        '.configs/builders/vite.config.mts': "import p from 'plugin-pkg';\n",
      },
    });

    expect(DeclaredImports.undeclared({ folder })).toEqual([
      'dyn-pkg (src/a.ts)',
      'plugin-pkg (.configs/builders/vite.config.mts)',
      'reexport-pkg (src/c.ts)',
      'req-pkg (src/b.cjs)',
    ]);
  });

  test('an import in a comment or a string is not an import', () => {
    const folder = createApp({
      manifest: { name: 'app' },
      files: {
        'src/a.ts':
          "// import x from 'in-comment';\nconst s = `import q from 'in-template'`;\nconst t = \"import r from 'in-string'\";\n",
      },
    });

    expect(DeclaredImports.undeclared({ folder })).toEqual([]);
  });

  test('node_modules, dist, build and declaration files are not read, and the app may import itself', () => {
    const folder = createApp({
      manifest: { name: '@scope/app' },
      files: {
        'node_modules/dep/index.js': "require('hidden-a');\n",
        'dist/index.js': "import 'hidden-b';\n",
        'build/index.js': "import 'hidden-c';\n",
        'src/types.d.ts': "import 'hidden-d';\n",
        'src/a.ts': "import { x } from '@scope/app/other';\n",
      },
    });

    expect(DeclaredImports.undeclared({ folder })).toEqual([]);
  });
});
