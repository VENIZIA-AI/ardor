import { describe, expect, test } from 'bun:test';

import { ReleaseVerify } from '../release-verify';

const noSleep = async () => {};

describe('ReleaseVerify.assertPublished', () => {
  test('returns the version that was not on the registry before the dispatch', async () => {
    const version = await ReleaseVerify.assertPublished({
      state: { packageName: '@venizia/ardor-kernel', publishedVersions: ['0.4.4', '0.4.5'] },
      listVersions: async () => ['0.4.4', '0.4.5', '0.4.6-0'],
      sleepFn: noSleep,
    });

    expect(version).toBe('0.4.6-0');
  });

  test('keeps reading until the registry lists the new version', async () => {
    const reads = [['0.4.5'], ['0.4.5'], ['0.4.5', '0.4.6-0']];
    let call = 0;

    const version = await ReleaseVerify.assertPublished({
      state: { packageName: '@venizia/ardor-kernel', publishedVersions: ['0.4.5'] },
      listVersions: async () => reads[Math.min(call++, reads.length - 1)] ?? [],
      sleepFn: noSleep,
    });

    expect(version).toBe('0.4.6-0');
    expect(call).toBe(3);
  });

  test('a dist-tag change is not a publish: only a new version counts', async () => {
    await expect(
      ReleaseVerify.assertPublished({
        state: { packageName: '@venizia/ardor-kernel', publishedVersions: ['0.4.5'] },
        listVersions: async () => ['0.4.5'],
        sleepFn: noSleep,
        attempts: 3,
      }),
    ).rejects.toThrow('shows no new version on the registry');
  });
});

describe('ReleaseVerify.verifyRun', () => {
  test('reads every planned package, then pulls once', async () => {
    const events: string[] = [];
    const published: Record<string, string[]> = {
      '@venizia/ardor-kernel': ['0.4.5', '0.4.6-0'],
      '@venizia/ardor-react': ['0.4.5', '0.4.6-0'],
    };

    const result = await ReleaseVerify.verifyRun({
      states: [
        { packageName: '@venizia/ardor-kernel', publishedVersions: ['0.4.5'] },
        { packageName: '@venizia/ardor-react', publishedVersions: ['0.4.5'] },
      ],
      listVersions: async ({ packageName }) => {
        events.push(`read ${packageName}`);
        return published[packageName] ?? [];
      },
      pull: async () => {
        events.push('pull');
      },
      sleepFn: noSleep,
    });

    expect(result).toEqual({
      '@venizia/ardor-kernel': '0.4.6-0',
      '@venizia/ardor-react': '0.4.6-0',
    });
    expect(events).toEqual(['read @venizia/ardor-kernel', 'read @venizia/ardor-react', 'pull']);
  });

  test('a package with no new version stops the check and nothing is pulled', async () => {
    let pulled = false;

    await expect(
      ReleaseVerify.verifyRun({
        states: [
          { packageName: '@venizia/ardor-kernel', publishedVersions: ['0.4.5'] },
          { packageName: '@venizia/ardor-react', publishedVersions: ['0.4.5'] },
        ],
        listVersions: async ({ packageName }) =>
          packageName === '@venizia/ardor-kernel' ? ['0.4.5', '0.4.6-0'] : ['0.4.5'],
        pull: async () => {
          pulled = true;
        },
        sleepFn: noSleep,
        attempts: 2,
      }),
    ).rejects.toThrow('@venizia/ardor-react shows no new version');

    expect(pulled).toBe(false);
  });
});
