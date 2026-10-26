import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getError } from '@venizia/ignis-inversion';

import {
  buildFixture,
  linkAllInstalledPackages,
  linkInstalledPackage,
  makeScratch,
  removeScratch,
  runBuiltEntry,
  writeFiles,
} from './fixture';

// vitejs/vite#21866: Rolldown can run a split-off chunk before `reflect-metadata`. The fixture is a
// DI library that needs `Reflect.getMetadata` as it is evaluated (tsyringe and inversify do), in a
// chunk of its own. `output.strictExecutionOrder` is the fix, and the preset turns it on.
const GUARDED_PACKAGE = '@fixture/guarded-di';
const GUARDED_GROUP = { name: 'di', test: /@fixture[\\/]guarded-di/ };

const PRESET_VITE_CONFIG = resolve(
  import.meta.dir,
  '../../../../../presets/app/files/.configs/builders/vite.config.mts',
);

const guardedFiles = {
  'package.json': JSON.stringify({ name: 'guarded-app', private: true, type: 'module' }),
  [`node_modules/${GUARDED_PACKAGE}/package.json`]: JSON.stringify({
    name: GUARDED_PACKAGE,
    version: '1.0.0',
    type: 'module',
    exports: './index.js',
    sideEffects: true,
  }),
  [`node_modules/${GUARDED_PACKAGE}/index.js`]: [
    "if (typeof Reflect === 'undefined' || typeof Reflect.getMetadata !== 'function') {",
    "  throw new Error('Reflect.getMetadata is not a function');",
    '}',
    'export const container = { ready: true };',
    '',
  ].join('\n'),
  'src/main.ts': [
    "import 'reflect-metadata';",
    '',
    `import { container } from '${GUARDED_PACKAGE}';`,
    '',
    "console.log('FIXTURE-OK', container.ready);",
    '',
  ].join('\n'),
};

describe('the preset turns on output.strictExecutionOrder', () => {
  test('its vite config sets the flag as the first option of build.rolldownOptions.output', () => {
    // Comments may sit before it; a commented-out line does not match.
    expect(readFileSync(PRESET_VITE_CONFIG, 'utf8')).toMatch(
      /rolldownOptions:\s*\{\s*output:\s*\{(?:\s*\/\/[^\n]*)*\s*strictExecutionOrder:\s*true,/,
    );
  });
});

describe('what output.strictExecutionOrder prevents', () => {
  let root: string;

  beforeAll(() => {
    root = makeScratch({ prefix: 'strict-order-guarded-' });

    writeFiles({ root, files: guardedFiles });
    linkInstalledPackage({ root, name: 'reflect-metadata' });
  });

  afterAll(() => {
    removeScratch({ root });
  });

  // Fails the day Rolldown orders the fixture correctly on its own: then the flag has no case left.
  test('with the flag off a split chunk runs before reflect-metadata and the DI module fails', async () => {
    await buildFixture({ root, chunkGroups: [GUARDED_GROUP] });
    const run = await runBuiltEntry({ root });

    if (run.exitCode === 0) {
      throw getError({
        message:
          'Rolldown now orders the fixture correctly without output.strictExecutionOrder: drop the flag from the preset (vitejs/vite#21866).',
      });
    }

    expect(run.stderr).toContain('Reflect.getMetadata is not a function');
  });

  test('with the flag on the same build loads', async () => {
    await buildFixture({ root, strictExecutionOrder: true, chunkGroups: [GUARDED_GROUP] });
    const run = await runBuiltEntry({ root });

    expect(run.stderr).toBe('');
    expect(run.stdout).toContain('FIXTURE-OK true');
    expect(run.exitCode).toBe(0);
  });
});

describe('the real ARDOR stack, with a React chunk group like the preset and the flag on', () => {
  let root: string;

  beforeAll(() => {
    root = makeScratch({ prefix: 'strict-order-stack-' });

    writeFiles({
      root,
      files: {
        'package.json': JSON.stringify({ name: 'stack-app', private: true, type: 'module' }),
        'src/main.ts': [
          "import 'reflect-metadata';",
          '',
          "import { ArdorApplication } from '@venizia/ardor-admin';",
          "import { BaseArdorApplication } from '@venizia/ardor-kernel';",
          "import { createRoot } from 'react-dom/client';",
          '',
          "console.log('STACK-OK', typeof ArdorApplication, typeof BaseArdorApplication, typeof createRoot);",
          '',
        ].join('\n'),
      },
    });
    linkAllInstalledPackages({ root });
  });

  afterAll(() => {
    removeScratch({ root });
  });

  test('builds and loads', async () => {
    await buildFixture({
      root,
      strictExecutionOrder: true,
      chunkGroups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
    });
    const run = await runBuiltEntry({ root });

    expect(run.stderr).toBe('');
    expect(run.stdout).toContain('STACK-OK function function function');
    expect(run.exitCode).toBe(0);
  });
});
