import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { BuildInfoEnvironmentKeys } from '@venizia/ignis-boot/build-info';
import { BuildInfoRegistry, type TBuildInfoRecord } from '@venizia/ignis-helpers/core';

import {
  completeFromGit,
  findInstalledVersion,
  type IBuildInfoSources,
  isBuildInfoRequest,
  readFrameworkVersions,
  readGit,
  readJsonFile,
  resolveBuildInfo,
  serializeBuildInfoFile,
  toBuildInfoFile,
  type TGitReadResult,
  UnresolvedPolicies,
} from '@/vite/build-info';

import { makeScratch, removeScratch, writeFiles } from './fixture';
import { rejectionOf } from '../rejection';

const UNSPECIFIED = BuildInfoRegistry.UNSPECIFIED;

const record = (overrides: Partial<TBuildInfoRecord> = {}): TBuildInfoRecord => ({
  service: '@acme/shop',
  version: '1.2.3',
  commit: 'abcdef123456',
  branch: 'main',
  builtAt: '2026-10-26T10:00:00.000Z',
  ...overrides,
});

const found = (value: string): TGitReadResult => ({ ok: true, value });
const notFound = (reason: string): TGitReadResult => ({ ok: false, reason });

const makeSources = (opts: {
  record?: TBuildInfoRecord;
  commit?: TGitReadResult;
  branch?: TGitReadResult;
  frameworks?: { versions: Record<string, string>; missing: string[] };
}): IBuildInfoSources => ({
  resolveRecord: async () => opts.record ?? record(),
  readGit: async ({ args }) =>
    args.includes('--abbrev-ref')
      ? (opts.branch ?? found('main'))
      : (opts.commit ?? found('0123456789ab')),
  readFrameworkVersions: async () => opts.frameworks ?? { versions: {}, missing: [] },
});

describe('UnresolvedPolicies', () => {
  test('knows its two values', () => {
    expect(UnresolvedPolicies.isValid('error')).toBe(true);
    expect(UnresolvedPolicies.isValid('unspecified')).toBe(true);
    expect(UnresolvedPolicies.isValid('ignore')).toBe(false);
  });
});

describe('completeFromGit', () => {
  test('keeps what the pipeline gave, even when git answers differently', () => {
    const result = completeFromGit({
      record: record(),
      commit: found('ffffffffffff'),
      branch: found('other'),
    });

    expect(result.commit).toBe('abcdef123456');
    expect(result.branch).toBe('main');
  });

  test('asks git only for a field that is unspecified', () => {
    const result = completeFromGit({
      record: record({ commit: UNSPECIFIED, branch: UNSPECIFIED }),
      commit: found('ffffffffffff'),
      branch: found('release'),
    });

    expect(result.commit).toBe('ffffffffffff');
    expect(result.branch).toBe('release');
  });

  test('leaves a field unspecified when git has no answer', () => {
    const result = completeFromGit({
      record: record({ commit: UNSPECIFIED }),
      commit: notFound('no git'),
      branch: found('x'),
    });

    expect(result.commit).toBe(UNSPECIFIED);
  });
});

describe('the file text', () => {
  test('lists the frameworks sorted by name, whatever order they came in', () => {
    const info = toBuildInfoFile({
      record: record(),
      frameworks: {
        '@venizia/ignis-kernel': '0.4.3',
        '@venizia/ardor': '0.4.3',
        '@venizia/ignis-helpers': '0.4.3',
      },
    });

    expect(Object.keys(info.frameworks)).toEqual([
      '@venizia/ardor',
      '@venizia/ignis-helpers',
      '@venizia/ignis-kernel',
    ]);
  });

  test('is the same text for the same input, with a fixed key order and a final newline', () => {
    const info = toBuildInfoFile({ record: record(), frameworks: { '@venizia/ardor': '0.4.3' } });

    expect(serializeBuildInfoFile({ info })).toBe(
      [
        '{',
        '  "service": "@acme/shop",',
        '  "version": "1.2.3",',
        '  "commit": "abcdef123456",',
        '  "branch": "main",',
        '  "builtAt": "2026-10-26T10:00:00.000Z",',
        '  "frameworks": {',
        '    "@venizia/ardor": "0.4.3"',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
  });

  test('does not depend on the key order of the record it was made from', () => {
    const shuffled = { builtAt: 'b', branch: 'c', commit: 'd', version: 'e', service: 'f' };
    const info = toBuildInfoFile({ record: shuffled, frameworks: {} });

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

describe('resolveBuildInfo', () => {
  const policy = UnresolvedPolicies.ERROR;

  test('answers with the stamp, the framework versions and no warning when everything resolves', async () => {
    const { info, warnings } = await resolveBuildInfo({
      root: '/app',
      scope: '@venizia/',
      policy,
      sources: makeSources({
        frameworks: { versions: { '@venizia/ardor': '0.4.3' }, missing: [] },
      }),
    });

    expect(info.commit).toBe('abcdef123456');
    expect(info.frameworks).toEqual({ '@venizia/ardor': '0.4.3' });
    expect(warnings).toEqual([]);
  });

  test('takes the commit from git when the pipeline gave none', async () => {
    const { info } = await resolveBuildInfo({
      root: '/app',
      scope: '@venizia/',
      policy,
      sources: makeSources({
        record: record({ commit: UNSPECIFIED }),
        commit: found('0123456789ab'),
      }),
    });

    expect(info.commit).toBe('0123456789ab');
  });

  test('with neither the pipeline nor git it throws, and the message names both causes and the fix', async () => {
    const resolution = resolveBuildInfo({
      root: '/app',
      scope: '@venizia/',
      policy,
      sources: makeSources({
        record: record({ commit: UNSPECIFIED }),
        commit: notFound('git rev-parse failed | not a git repository'),
      }),
    });

    expect(String(await rejectionOf(resolution))).toContain('APP_BUILD_COMMIT');
    expect(String(await rejectionOf(resolution))).toContain('not a git repository');
  });

  test('with the unspecified policy it keeps going and warns', async () => {
    const { info, warnings } = await resolveBuildInfo({
      root: '/app',
      scope: '@venizia/',
      policy: UnresolvedPolicies.UNSPECIFIED,
      sources: makeSources({ record: record({ commit: UNSPECIFIED }), commit: notFound('no git') }),
    });

    expect(info.commit).toBe(UNSPECIFIED);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('no commit');
  });

  test('a branch nobody knows is a warning, not an error', async () => {
    const { info, warnings } = await resolveBuildInfo({
      root: '/app',
      scope: '@venizia/',
      policy,
      sources: makeSources({
        record: record({ branch: UNSPECIFIED }),
        branch: notFound('detached'),
      }),
    });

    expect(info.branch).toBe(UNSPECIFIED);
    expect(warnings.some((warning) => warning.includes('no branch'))).toBe(true);
  });

  test('warns about a declared dependency that is not installed', async () => {
    const { warnings } = await resolveBuildInfo({
      root: '/app',
      scope: '@venizia/',
      policy,
      sources: makeSources({ frameworks: { versions: {}, missing: ['@venizia/ardor'] } }),
    });

    expect(warnings).toEqual([
      expect.stringContaining('@venizia/ardor is a dependency with no installed package.json'),
    ]);
  });
});

describe('reading from disk', () => {
  let root: string;

  beforeAll(() => {
    root = makeScratch({ prefix: 'build-info-disk-' });

    writeFiles({
      root,
      files: {
        'apps/shop/package.json': JSON.stringify({
          name: '@acme/shop',
          version: '9.9.9',
          dependencies: {
            '@venizia/ardor': 'catalog:',
            react: '19.0.0',
            '@venizia/not-installed': '1.0.0',
          },
          devDependencies: { '@venizia/ignis-boot': 'catalog:', vite: '8.0.0' },
        }),
        'apps/shop/node_modules/@venizia/ardor/package.json': JSON.stringify({ version: '0.4.3' }),
        // Hoisted to the workspace root, the way a monorepo install lays it out.
        'node_modules/@venizia/ignis-boot/package.json': JSON.stringify({ version: '0.4.3' }),
        'broken/package.json': '{ not json',
      },
    });
    mkdirSync(join(root, 'empty'), { recursive: true });
  });

  afterAll(() => {
    removeScratch({ root });
  });

  test('readJsonFile: a missing file is undefined, a broken one is an error that names the file', async () => {
    expect(await readJsonFile({ path: join(root, 'empty', 'package.json') })).toBeUndefined();
    expect(
      String(await rejectionOf(readJsonFile({ path: join(root, 'broken', 'package.json') }))),
    ).toContain(join(root, 'broken', 'package.json'));
  });

  test('findInstalledVersion walks up the node_modules folders like Node does', async () => {
    const app = join(root, 'apps', 'shop');

    expect(await findInstalledVersion({ root: app, name: '@venizia/ardor' })).toBe('0.4.3');
    expect(await findInstalledVersion({ root: app, name: '@venizia/ignis-boot' })).toBe('0.4.3');
    expect(await findInstalledVersion({ root: app, name: '@venizia/nothing' })).toBeUndefined();
  });

  test('readFrameworkVersions lists the installed versions of the scope and the ones not installed', async () => {
    const result = await readFrameworkVersions({
      root: join(root, 'apps', 'shop'),
      scope: '@venizia/',
    });

    expect(result.versions).toEqual({ '@venizia/ardor': '0.4.3', '@venizia/ignis-boot': '0.4.3' });
    expect(result.missing).toEqual(['@venizia/not-installed']);
  });

  test('readFrameworkVersions without a package.json is an error that says where to look', async () => {
    expect(
      String(
        await rejectionOf(readFrameworkVersions({ root: join(root, 'empty'), scope: '@venizia/' })),
      ),
    ).toContain('root option');
  });
});

describe('readGit', () => {
  test('answers with the short commit of this repository', async () => {
    const repository = resolve(import.meta.dir, '../../../../..');
    const result = await readGit({ root: repository, args: ['rev-parse', '--short=12', 'HEAD'] });

    expect(result.ok).toBe(true);
    expect(result.ok && /^[0-9a-f]{12}$/.test(result.value)).toBe(true);
  });

  test('says why git failed, instead of failing silently', async () => {
    const repository = resolve(import.meta.dir, '../../../../..');
    const result = await readGit({
      root: repository,
      args: ['rev-parse', '--verify', 'refs/heads/no-such-branch'],
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain(
      'git rev-parse --verify refs/heads/no-such-branch failed',
    );
  });

  test('says so when git answers with nothing', async () => {
    const repository = resolve(import.meta.dir, '../../../../..');
    const result = await readGit({ root: repository, args: ['rev-parse', '--show-prefix'] });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('printed nothing');
  });
});

describe('under Node, which is where Vite runs', () => {
  test('the commit comes from git although the IGNIS resolver cannot reach it without Bun', async () => {
    const dist = resolve(import.meta.dir, '../../../dist/vite/build-info.js');
    const repository = resolve(import.meta.dir, '../../../../..');
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !BuildInfoEnvironmentKeys.COMMIT.includes(key)),
    );
    const script = [
      `import { defaultSources, resolveBuildInfo, UnresolvedPolicies } from ${JSON.stringify(dist)};`,
      `const { info } = await resolveBuildInfo({ root: ${JSON.stringify(repository)}, scope: '@venizia/', policy: UnresolvedPolicies.ERROR, sources: defaultSources });`,
      'console.log(info.commit);',
    ].join('\n');

    const child = Bun.spawn(['node', '--input-type=module', '-e', script], {
      env: environment,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    expect(stderr).toBe('');
    expect(stdout.trim()).toMatch(/^[0-9a-f]{12}$/);
    expect(exitCode).toBe(0);
  });
});
