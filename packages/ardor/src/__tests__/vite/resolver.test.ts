import { describe, expect, test } from 'bun:test';

import type { IBuildInfoFile } from '@venizia/ardor-kernel';
import { BuildInfoRegistry, type TBuildInfoRecord } from '@venizia/ignis-helpers/core';

import { type IBuildInfoSources, type TGitReadResult, UnresolvedPolicies } from '@/vite/common';
import {
  completeFromGit,
  resolveBuildInfo,
  serializeBuildInfoFile,
  toBuildInfoFile,
} from '@/vite/resolver';

import { rejectionOf } from '@venizia/dev-configs/testing';

const UNSPECIFIED = BuildInfoRegistry.UNSPECIFIED;

const makeRecord = (opts: { overrides?: Partial<TBuildInfoRecord> } = {}): TBuildInfoRecord => ({
  service: '@acme/shop',
  version: '1.2.3',
  commit: 'abcdef123456',
  branch: 'main',
  builtAt: '2026-10-26T10:00:00.000Z',
  ...opts.overrides,
});

const makeFound = (opts: { value: string }): TGitReadResult => ({ ok: true, value: opts.value });
const makeNotFound = (opts: { reason: string }): TGitReadResult => ({
  ok: false,
  reason: opts.reason,
});

const makeSources = (opts: {
  record?: TBuildInfoRecord;
  commit?: TGitReadResult;
  branch?: TGitReadResult;
  frameworks?: { versions: Record<string, string>; missing: string[]; invalid: string[] };
}): IBuildInfoSources => ({
  resolveRecord: async () => opts.record ?? makeRecord(),
  readGit: async ({ args }) =>
    args.includes('--abbrev-ref')
      ? (opts.branch ?? makeFound({ value: 'main' }))
      : (opts.commit ?? makeFound({ value: '0123456789ab' })),
  readFrameworkVersions: async () => opts.frameworks ?? { versions: {}, missing: [], invalid: [] },
});

const resolveWith = (opts: {
  sources: IBuildInfoSources;
  policy?: typeof UnresolvedPolicies.ERROR | typeof UnresolvedPolicies.UNSPECIFIED;
}) =>
  resolveBuildInfo({
    root: '/app',
    scope: '@venizia/',
    policy: opts.policy ?? UnresolvedPolicies.ERROR,
    sources: opts.sources,
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
      record: makeRecord(),
      commit: makeFound({ value: 'ffffffffffff' }),
      branch: makeFound({ value: 'other' }),
    });

    expect(result.commit).toBe('abcdef123456');
    expect(result.branch).toBe('main');
  });

  test('asks git only for a field that is unspecified', () => {
    const result = completeFromGit({
      record: makeRecord({ overrides: { commit: UNSPECIFIED, branch: UNSPECIFIED } }),
      commit: makeFound({ value: 'ffffffffffff' }),
      branch: makeFound({ value: 'release' }),
    });

    expect(result.commit).toBe('ffffffffffff');
    expect(result.branch).toBe('release');
  });

  test('leaves a field unspecified when git has no answer', () => {
    const result = completeFromGit({
      record: makeRecord({ overrides: { commit: UNSPECIFIED } }),
      commit: makeNotFound({ reason: 'no git' }),
      branch: makeFound({ value: 'x' }),
    });

    expect(result.commit).toBe(UNSPECIFIED);
  });
});

describe('the file text', () => {
  test('lists the frameworks sorted by name, whatever order they came in', () => {
    const info = toBuildInfoFile({
      record: makeRecord(),
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
    const info = toBuildInfoFile({
      record: makeRecord(),
      frameworks: { '@venizia/ardor': '0.4.3' },
    });

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

  test('keeps the key order whatever order the object was built in', () => {
    const shuffled: IBuildInfoFile = {
      frameworks: {},
      builtAt: 'b',
      branch: 'c',
      commit: 'd',
      version: 'e',
      service: 'f',
    };
    const keys = Object.keys(JSON.parse(serializeBuildInfoFile({ info: shuffled })));

    expect(keys).toEqual(['service', 'version', 'commit', 'branch', 'builtAt', 'frameworks']);
  });
});

describe('resolveBuildInfo', () => {
  test('answers with the stamp, the framework versions and no warning when everything resolves', async () => {
    const { info, warnings } = await resolveWith({
      sources: makeSources({
        frameworks: { versions: { '@venizia/ardor': '0.4.3' }, missing: [], invalid: [] },
      }),
    });

    expect(info.commit).toBe('abcdef123456');
    expect(info.frameworks).toEqual({ '@venizia/ardor': '0.4.3' });
    expect(warnings).toEqual([]);
  });

  test('takes the commit from git when the pipeline gave none', async () => {
    const { info } = await resolveWith({
      sources: makeSources({
        record: makeRecord({ overrides: { commit: UNSPECIFIED } }),
        commit: makeFound({ value: '0123456789ab' }),
      }),
    });

    expect(info.commit).toBe('0123456789ab');
  });

  test('with neither the pipeline nor git it throws, and the message names both causes and the fix', async () => {
    const task = resolveWith({
      sources: makeSources({
        record: makeRecord({ overrides: { commit: UNSPECIFIED } }),
        commit: makeNotFound({ reason: 'git rev-parse failed | not a git repository' }),
      }),
    });
    const result = await rejectionOf(task);
    const message = String(result);

    expect(message).toContain('APP_BUILD_COMMIT');
    expect(message).toContain('not a git repository');
  });

  test('with the unspecified policy it keeps going and warns', async () => {
    const { info, warnings } = await resolveWith({
      policy: UnresolvedPolicies.UNSPECIFIED,
      sources: makeSources({
        record: makeRecord({ overrides: { commit: UNSPECIFIED } }),
        commit: makeNotFound({ reason: 'no git' }),
      }),
    });

    expect(info.commit).toBe(UNSPECIFIED);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('no commit');
  });

  test('a branch nobody knows is a warning, not an error', async () => {
    const { info, warnings } = await resolveWith({
      sources: makeSources({
        record: makeRecord({ overrides: { branch: UNSPECIFIED } }),
        branch: makeNotFound({ reason: 'detached' }),
      }),
    });

    expect(info.branch).toBe(UNSPECIFIED);
    expect(warnings.some((warning) => warning.includes('no branch'))).toBe(true);
  });

  test('warns about a declared dependency that is not installed, and about a name that is not a package name', async () => {
    const { warnings } = await resolveWith({
      sources: makeSources({
        frameworks: { versions: {}, missing: ['@venizia/ardor'], invalid: ['@venizia/../x'] },
      }),
    });

    expect(warnings).toEqual([
      expect.stringContaining('@venizia/ardor is a dependency with no installed package.json'),
      expect.stringContaining("'@venizia/../x' is not a package name"),
    ]);
  });
});
