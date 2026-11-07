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

// The preset has no catch-all `vendor` group in `codeSplitting`: it takes every module under node_modules into one
// chunk, so the libraries that only a lazy route imports land in a chunk the first screen loads (issue #668,
// measured on six apps in the Vite setup guide). The opt-in of the guide, `minShareCount: 2` with `entriesAware`, is pinned too.
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

/** Every lazy library, and the one two routes share, sit in chunks that the first screen does not load. */
const expectLazyLibrariesLater = (opts: { root: string }): void => {
  const first = new Set(firstLoadChunks(opts).map((chunk) => chunk.file));
  const later = readChunks(opts)
    .filter((chunk) => !first.has(chunk.file))
    .map((chunk) => chunk.code)
    .join('\n');

  expect(later).toContain('MARK-SHARED-');

  for (const index of routes) {
    expect(later).toContain(`MARK-LAZY-${index}-`);
  }
};

const firstLoadCode = (root: string): string => {
  return firstLoadChunks({ root })
    .map((chunk) => chunk.code)
    .join('\n');
};

describe('the preset has a react group and no vendor group', () => {
  const groups = (): string => {
    const text = readFileSync(PRESET_VITE_CONFIG, 'utf8');

    return text.slice(text.indexOf('codeSplitting'));
  };

  test('codeSplitting holds the react group', () => {
    expect(groups()).toMatch(/name:\s*'react',\s*test:\s*\/node_modules/);
  });

  test('codeSplitting holds no group that takes all of node_modules', () => {
    expect(groups()).not.toMatch(/name:\s*'vendor'/);
    expect(groups()).not.toMatch(/test:\s*\/node_modules\/\s*[,}]/);
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

  // Fails the day Rolldown stops putting every module of a catch-all group in one chunk: then the preset has no case left to avoid.
  test('with a catch-all vendor group the lazy libraries are in the chunk the first screen loads', async () => {
    await buildFixture({ root, strictExecutionOrder: true });
    const code = firstLoadCode(root);

    for (const index of routes) {
      expect(code).toContain(`MARK-LAZY-${index}-`);
    }

    expect(Math.max(...readChunks({ root }).map((chunk) => chunk.size))).toBeGreaterThan(
      LIBRARY_BYTES * LAZY_ROUTES,
    );
  });

  test('without a vendor group, as the preset is, the first screen has the entry library and no lazy library', async () => {
    await buildFixture({ root, strictExecutionOrder: true, vendorGroup: false });
    const code = firstLoadCode(root);

    expect(code).toContain('MARK-EAGER-');

    for (const index of routes) {
      expect(code).not.toContain(`MARK-LAZY-${index}-`);
    }
  });

  test('without a vendor group every lazy library is still built, in a chunk the first screen does not load', async () => {
    await buildFixture({ root, strictExecutionOrder: true, vendorGroup: false });

    expectLazyLibrariesLater({ root });
  });

  test(`without a vendor group no chunk is larger than ${MAX_CHUNK_BYTES / 1000} KB`, async () => {
    await buildFixture({ root, strictExecutionOrder: true, vendorGroup: false });
    const largest = Math.max(...readChunks({ root }).map((chunk) => chunk.size));

    expect(largest).toBeLessThan(MAX_CHUNK_BYTES);
  });

  // The opt-in of the guide: it keeps the lazy libraries off the first screen too, in chunks of their own.
  test('the opt-in vendor group, minShareCount 2 with entriesAware, keeps the lazy libraries off the first screen', async () => {
    await buildFixture({
      root,
      strictExecutionOrder: true,
      vendorGroup: { minShareCount: 2, entriesAware: true },
    });
    const code = firstLoadCode(root);

    expect(code).toContain('MARK-EAGER-');

    for (const index of routes) {
      expect(code).not.toContain(`MARK-LAZY-${index}-`);
    }

    expectLazyLibrariesLater({ root });
  });
});
