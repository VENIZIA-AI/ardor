import { describe, expect, test } from 'bun:test';

import type { IBuildInfoFile } from '@venizia/ardor-kernel';
import { BuildInfoRegistry, type TBuildInfoRecord } from '@venizia/ignis-helpers/core';

import { type IBuildInfoSources, UnresolvedPolicies } from '@/vite/common';
import { resolveBuildInfo, serializeBuildInfoFile, toBuildInfoFile } from '@/vite/resolver';

import { RejectionHelper } from '@venizia/dev-configs/testing';

const UNSPECIFIED = BuildInfoRegistry.UNSPECIFIED;

const makeRecord = (opts: { overrides?: Partial<TBuildInfoRecord> } = {}): TBuildInfoRecord => ({
  service: '@acme/shop',
  version: '1.2.3',
  commit: 'abcdef123456',
  branch: 'main',
  builtAt: '2026-10-26T10:00:00.000Z',
  ...opts.overrides,
});

const makeSources = (opts: {
  record?: TBuildInfoRecord;
  frameworks?: { versions: Record<string, string>; missing: string[]; invalid: string[] };
}): IBuildInfoSources => ({
  resolveRecord: async () => opts.record ?? makeRecord(),
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

  test('keeps the commit and the branch the stamp holds, and asks nothing else of git', async () => {
    const { info } = await resolveWith({
      sources: makeSources({
        record: makeRecord({ overrides: { commit: 'fedcba654321', branch: 'release' } }),
      }),
    });

    expect(info.commit).toBe('fedcba654321');
    expect(info.branch).toBe('release');
  });

  test('with no commit in the stamp it throws, and the message names the pipeline variable and the fix', async () => {
    const task = resolveWith({
      sources: makeSources({ record: makeRecord({ overrides: { commit: UNSPECIFIED } }) }),
    });
    const result = await RejectionHelper.rejectionOf({ task });
    const message = String(result);

    expect(message).toContain('APP_BUILD_COMMIT');
    expect(message).toContain('git checkout');
  });

  test('with the unspecified policy it keeps going and warns', async () => {
    const { info, warnings } = await resolveWith({
      policy: UnresolvedPolicies.UNSPECIFIED,
      sources: makeSources({
        record: makeRecord({ overrides: { commit: UNSPECIFIED } }),
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
