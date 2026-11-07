import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildFixture,
  firstLoadChunks,
  makeScratch,
  readChunks,
  removeScratch,
  writeFiles,
} from './fixture';

// vendor-group: the preset's `vendor` group of `codeSplitting` takes every module under node_modules into one
// chunk unless it sets `minShareCount`, so the libraries that only a lazy route imports land in a chunk the first
// screen loads (issue #668, measured on six apps in the Vite setup guide).
const PRESET_VITE_CONFIG = resolve(
  import.meta.dir,
  '../../../../../presets/app/files/.configs/builders/vite.config.mts',
);

const LAZY_ROUTES = 6;
const LIBRARY_BYTES = 50_000;
/** The most any chunk of the fixture build may weigh: one lazy library, with its route, is about 50 KB. */
const MAX_CHUNK_BYTES = 100_000;

const filler = (seed: number): string => {
  let out = '';
  let x = seed;

  while (out.length < LIBRARY_BYTES) {
    x = (x * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
    out += x.toString(36);
  }

  return out;
};

const library = (opts: { name: string; marker: string; seed: number }) => ({
  [`node_modules/${opts.name}/package.json`]: JSON.stringify({
    name: opts.name,
    version: '1.0.0',
    type: 'module',
    exports: './index.js',
    sideEffects: false,
  }),
  // The value depends on the argument, so the minifier-free build keeps the whole string.
  [`node_modules/${opts.name}/index.js`]: `const data = '${opts.marker}${filler(opts.seed)}';\nexport const read = (key) => data + key;\n`,
});

const routes = Array.from({ length: LAZY_ROUTES }, (_, index) => index);

const files: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'lazy-app', private: true, type: 'module' }),
  'src/main.ts': [
    "import { read as readEager } from '@fixture/eager';",
    '',
    'const routes = {',
    ...routes.map((index) => `  r${index}: () => import('./routes/r${index}'),`),
    '};',
    '',
    "console.log('FIXTURE-OK', readEager(Date.now()).length, Object.keys(routes).length);",
    '',
  ].join('\n'),
  ...library({ name: '@fixture/eager', marker: 'MARK-EAGER-', seed: 1 }),
  // Two lazy routes import it: shared by two chunks, so the vendor group may take it.
  ...library({ name: '@fixture/shared', marker: 'MARK-SHARED-', seed: 2 }),
  ...Object.fromEntries(
    routes.flatMap((index) => [
      ...Object.entries(
        library({
          name: `@fixture/lazy-${index}`,
          marker: `MARK-LAZY-${index}-`,
          seed: 10 + index,
        }),
      ),
      [
        `src/routes/r${index}.ts`,
        [
          `import { read } from '@fixture/lazy-${index}';`,
          ...(index < 2 ? ["import { read as readShared } from '@fixture/shared';"] : []),
          '',
          `export default (key: number) => read(key)${index < 2 ? ' + readShared(key)' : ''};`,
          '',
        ].join('\n'),
      ],
    ]),
  ),
};

const firstLoadCode = (root: string): string => {
  return firstLoadChunks({ root })
    .map((chunk) => chunk.code)
    .join('\n');
};

describe('the preset sets minShareCount on its vendor group', () => {
  test('the vendor group takes the modules two chunks share, not every module under node_modules', () => {
    expect(readFileSync(PRESET_VITE_CONFIG, 'utf8')).toMatch(
      /\{\s*name:\s*'vendor',\s*test:\s*\/node_modules\/,\s*minShareCount:\s*2\s*\}/,
    );
  });
});

describe('an eager entry and lazy routes that each import a library of their own', () => {
  let root: string;

  beforeAll(() => {
    root = makeScratch({ prefix: 'vendor-group-' });
    writeFiles({ root, files });
  });

  afterAll(() => {
    removeScratch({ root });
  });

  // Fails the day Rolldown stops putting every module of the group in one chunk by default: then the option has no case left.
  test('without minShareCount the lazy libraries are in the chunk the first screen loads', async () => {
    await buildFixture({ root, strictExecutionOrder: true });
    const code = firstLoadCode(root);

    for (const index of routes) {
      expect(code).toContain(`MARK-LAZY-${index}-`);
    }

    expect(Math.max(...readChunks({ root }).map((chunk) => chunk.size))).toBeGreaterThan(
      LIBRARY_BYTES * LAZY_ROUTES,
    );
  });

  test('with minShareCount 2 the first screen has the entry library and no lazy library', async () => {
    await buildFixture({ root, strictExecutionOrder: true, vendorMinShareCount: 2 });
    const code = firstLoadCode(root);

    expect(code).toContain('MARK-EAGER-');
    expect(code).not.toContain('MARK-SHARED-');

    for (const index of routes) {
      expect(code).not.toContain(`MARK-LAZY-${index}-`);
    }
  });

  test('with minShareCount 2 every lazy library is still built, in a chunk the first screen does not load', async () => {
    await buildFixture({ root, strictExecutionOrder: true, vendorMinShareCount: 2 });
    const first = new Set(firstLoadChunks({ root }).map((chunk) => chunk.file));
    const later = readChunks({ root })
      .filter((chunk) => !first.has(chunk.file))
      .map((chunk) => chunk.code)
      .join('\n');

    expect(later).toContain('MARK-SHARED-');

    for (const index of routes) {
      expect(later).toContain(`MARK-LAZY-${index}-`);
    }
  });

  test(`with minShareCount 2 no chunk is larger than ${MAX_CHUNK_BYTES / 1000} KB`, async () => {
    await buildFixture({ root, strictExecutionOrder: true, vendorMinShareCount: 2 });
    const largest = Math.max(...readChunks({ root }).map((chunk) => chunk.size));

    expect(largest).toBeLessThan(MAX_CHUNK_BYTES);
  });
});
