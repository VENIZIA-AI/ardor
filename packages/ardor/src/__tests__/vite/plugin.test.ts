import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { IBuildInfoFile } from '@venizia/ardor-kernel';
import { BuildInfoEnvironmentKeys } from '@venizia/ignis-boot/build-info';
import { BuildInfoRegistry, type TBuildInfoRecord } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';
import { build, createServer, type ViteDevServer } from 'vite';

import { type IBuildInfoSources, UnresolvedPolicies } from '@/vite/common';
import {
  buildInfoFile,
  createBuildInfoFilePlugin,
  isBuildInfoRequest,
  parseBuildInfoFileOptions,
} from '@/vite/plugin';

import { getRejection } from '../rejection';
import { makeScratch, removeScratch, writeFiles } from './fixture';

const STAMP: TBuildInfoRecord = {
  service: '@acme/shop',
  version: '1.2.3',
  commit: 'abcdef123456',
  branch: 'main',
  builtAt: '2026-10-26T10:00:00.000Z',
};

const FRAMEWORKS = { '@venizia/ardor': '0.4.3' };

const EXPECTED_TEXT = `${JSON.stringify({ ...STAMP, frameworks: FRAMEWORKS }, null, 2)}\n`;

const makeFakeSources = (
  opts: { record?: TBuildInfoRecord; failTimes?: number } = {},
): IBuildInfoSources => {
  let failures = opts.failTimes ?? 0;

  return {
    resolveRecord: async () => {
      if (failures > 0) {
        failures -= 1;

        throw getError({ message: `no manifest in ${STAMP.service}` });
      }

      return opts.record ?? STAMP;
    },
    readGit: async () => ({ ok: false, reason: 'no git in this test' }),
    readFrameworkVersions: async () => ({ versions: FRAMEWORKS, missing: [], invalid: [] }),
  };
};

const withoutCommit = (): TBuildInfoRecord => ({ ...STAMP, commit: BuildInfoRegistry.UNSPECIFIED });

const appFiles = {
  'package.json': JSON.stringify({
    name: '@acme/shop',
    version: '1.2.3',
    private: true,
    type: 'module',
    dependencies: { '@venizia/ardor': 'catalog:' },
  }),
  'node_modules/@venizia/ardor/package.json': JSON.stringify({
    name: '@venizia/ardor',
    version: '0.4.3',
  }),
  'src/main.ts': "console.log('app');\n",
};

describe('parseBuildInfoFileOptions', () => {
  test('fills the defaults', () => {
    expect(parseBuildInfoFileOptions({})).toEqual({
      root: process.cwd(),
      fileName: 'build-info.json',
      frameworkScope: '@venizia/',
      onUnresolved: UnresolvedPolicies.ERROR,
    });
  });

  test.each([
    '',
    '/build-info.json',
    '../build-info.json',
    'a/../b.json',
    'a//b.json',
    'build info.json',
    'build-info',
    'build-info.txt',
    'C:\\x.json',
  ])(
    'refuses the file name %p, because it could leave the output folder or is not a JSON path',
    (fileName) => {
      expect(() => parseBuildInfoFileOptions({ fileName })).toThrow('fileName');
    },
  );

  test.each(['meta/info.json', 'build-info.json', 'a.b_c-d.json'])(
    'accepts the file name %p',
    (fileName) => {
      expect(parseBuildInfoFileOptions({ fileName }).fileName).toBe(fileName);
    },
  );

  test('refuses an empty scope and an unknown policy', () => {
    expect(() => parseBuildInfoFileOptions({ frameworkScope: '' })).toThrow('frameworkScope');
    // A plain JavaScript caller can pass anything; JSON.parse stands in for one.
    expect(() => parseBuildInfoFileOptions(JSON.parse('{"onUnresolved":"ignore"}'))).toThrow(
      'onUnresolved',
    );
  });

  test('buildInfoFile refuses invalid options when it is created', () => {
    expect(() => buildInfoFile({ fileName: '../x.json' })).toThrow('fileName');
  });
});

describe('isBuildInfoRequest', () => {
  test.each([
    ['/build-info.json', '/', 'build-info.json', true],
    ['/build-info.json?t=1', '/', 'build-info.json', true],
    ['/app/build-info.json', '/app/', 'build-info.json', true],
    ['/meta/info.json', '/', 'meta/info.json', true],
    ['/app/build-info.json', '/', 'build-info.json', false],
    ['/build-info.json.map', '/', 'build-info.json', false],
    ['/other.json', '/', 'build-info.json', false],
    [undefined, '/', 'build-info.json', false],
  ])('%p on base %p for %p is %p', (url, base, fileName, expected) => {
    expect(isBuildInfoRequest({ url, base, fileName })).toBe(expected);
  });
});

describe('the dev server', () => {
  let root: string;
  let server: ViteDevServer;
  let origin: string;

  const startServer = async (opts: { sources: IBuildInfoSources; base?: string }) => {
    const started = await createServer({
      root,
      base: opts.base,
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      server: { port: 0, hmr: false, watch: null },
      plugins: [createBuildInfoFilePlugin({ options: { root }, sources: opts.sources })],
    });

    await started.listen();

    return started;
  };

  const getUrl = (opts: { started: ViteDevServer }): string =>
    `${opts.started.resolvedUrls?.local[0] ?? ''}build-info.json`;

  beforeAll(async () => {
    root = makeScratch({ prefix: 'build-info-dev-' });
    writeFiles({ root, files: appFiles });
    server = await startServer({ sources: makeFakeSources() });
    origin = server.resolvedUrls?.local[0] ?? '';
  });

  afterAll(async () => {
    await server.close();
    removeScratch({ root });
  });

  test('GET answers with the file as JSON that is never cached', async () => {
    const response = await fetch(`${origin}build-info.json`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-length')).toBe(String(Buffer.byteLength(EXPECTED_TEXT)));
    expect(await response.text()).toBe(EXPECTED_TEXT);
  });

  test('a query string does not change the answer', async () => {
    expect(await (await fetch(`${origin}build-info.json?t=1`)).text()).toBe(EXPECTED_TEXT);
  });

  test('HEAD answers with the same headers and no body', async () => {
    const response = await fetch(`${origin}build-info.json`, { method: 'HEAD' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe(String(Buffer.byteLength(EXPECTED_TEXT)));
    expect(await response.text()).toBe('');
  });

  test('any other method is refused, and says which are allowed', async () => {
    const response = await fetch(`${origin}build-info.json`, { method: 'POST', body: '{}' });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });

  test('another path is left to the rest of the dev server', async () => {
    expect((await fetch(`${origin}other.json`)).status).toBe(404);
  });

  test('the file lives under the base of the dev server', async () => {
    const underBase = await startServer({ sources: makeFakeSources(), base: '/app/' });

    try {
      expect(await (await fetch(getUrl({ started: underBase }))).text()).toBe(EXPECTED_TEXT);
    } finally {
      await underBase.close();
    }
  });

  test('a resolution that fails is a 500 without a path or a stack, and the next request tries again', async () => {
    const failing = await startServer({ sources: makeFakeSources({ failTimes: 1 }) });

    try {
      const first = await fetch(getUrl({ started: failing }));
      const body = await first.text();

      expect(first.status).toBe(500);
      expect(body).toContain('build-info.json is unavailable');
      expect(body).not.toContain(root);
      expect(body).not.toContain('at ');

      const second = await fetch(getUrl({ started: failing }));

      expect(second.status).toBe(200);
      expect(await second.text()).toBe(EXPECTED_TEXT);
    } finally {
      await failing.close();
    }
  });

  test('without a commit the dev server serves what it has instead of refusing', async () => {
    const unresolved = await startServer({
      sources: makeFakeSources({ record: withoutCommit() }),
    });

    try {
      const response = await fetch(getUrl({ started: unresolved }));
      const info: IBuildInfoFile = await response.json();

      expect(response.status).toBe(200);
      expect(info.commit).toBe(BuildInfoRegistry.UNSPECIFIED);
    } finally {
      await unresolved.close();
    }
  });
});

describe('the build', () => {
  let root: string;

  const buildApp = async (opts: { plugin: ReturnType<typeof buildInfoFile> }) => {
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [opts.plugin],
      build: { outDir: 'dist', rolldownOptions: { input: 'src/main.ts' } },
    });
  };

  beforeAll(() => {
    root = makeScratch({ prefix: 'build-info-build-' });
    writeFiles({ root, files: appFiles });
  });

  afterAll(() => {
    removeScratch({ root });
  });

  test('emits the file into the output folder', async () => {
    await buildApp({
      plugin: createBuildInfoFilePlugin({ options: { root }, sources: makeFakeSources() }),
    });

    expect(readFileSync(join(root, 'dist', 'build-info.json'), 'utf8')).toBe(EXPECTED_TEXT);
  });

  test('emits it under a folder of the output when the file name has one, and nowhere else', async () => {
    await buildApp({
      plugin: createBuildInfoFilePlugin({
        options: { root, fileName: 'meta/info.json' },
        sources: makeFakeSources(),
      }),
    });

    expect(existsSync(join(root, 'dist', 'meta', 'info.json'))).toBe(true);
    expect(existsSync(join(root, 'meta'))).toBe(false);
    expect(existsSync(resolve(root, '..', 'info.json'))).toBe(false);
  });

  test('without a commit the build fails with a message that names the fix', async () => {
    const plugin = createBuildInfoFilePlugin({
      options: { root },
      sources: makeFakeSources({ record: withoutCommit() }),
    });

    expect(String(await getRejection({ task: buildApp({ plugin }) }))).toContain(
      'APP_BUILD_COMMIT',
    );
  });

  test('with the unspecified policy the build keeps going', async () => {
    await buildApp({
      plugin: createBuildInfoFilePlugin({
        options: { root, onUnresolved: UnresolvedPolicies.UNSPECIFIED },
        sources: makeFakeSources({ record: withoutCommit() }),
      }),
    });

    const info: IBuildInfoFile = JSON.parse(
      readFileSync(join(root, 'dist', 'build-info.json'), 'utf8'),
    );

    expect(info.commit).toBe(BuildInfoRegistry.UNSPECIFIED);
  });
});

describe('the default sources, as a build under Node uses them', () => {
  let root: string;
  const saved: Record<string, string | undefined> = {};
  const ENVIRONMENT = {
    APP_BUILD_COMMIT: '0123456789abcdef0123',
    APP_BUILD_BRANCH: 'release/1.2',
  };
  // CI sets some of these itself (GITHUB_REF_NAME is the version on a branch build): the test owns all of them.
  const KEYS = [
    ...BuildInfoEnvironmentKeys.VERSION,
    ...BuildInfoEnvironmentKeys.COMMIT,
    ...BuildInfoEnvironmentKeys.BRANCH,
    ...BuildInfoEnvironmentKeys.BUILT_AT,
  ];

  beforeAll(() => {
    root = makeScratch({ prefix: 'build-info-real-' });
    writeFiles({ root, files: appFiles });

    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }

    Object.assign(process.env, ENVIRONMENT);
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    removeScratch({ root });
  });

  test('a real build writes the stamp of the pipeline, the app and its installed framework versions', async () => {
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [buildInfoFile({ root })],
      build: { outDir: 'dist', rolldownOptions: { input: 'src/main.ts' } },
    });

    const info: IBuildInfoFile = JSON.parse(
      readFileSync(join(root, 'dist', 'build-info.json'), 'utf8'),
    );

    expect(info.service).toBe('@acme/shop');
    expect(info.version).toBe('1.2.3');
    expect(info.commit).toBe('0123456789ab');
    expect(info.branch).toBe('release/1.2');
    expect(info.frameworks).toEqual({ '@venizia/ardor': '0.4.3' });
    expect(Object.keys(info)).toEqual([
      'service',
      'version',
      'commit',
      'branch',
      'builtAt',
      'frameworks',
    ]);
  });
});
