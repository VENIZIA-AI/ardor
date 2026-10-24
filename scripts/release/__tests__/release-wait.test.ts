import { describe, expect, test } from 'bun:test';
import { tarballUrl, waitForTarball } from '../release-wait';

/** A fetch that answers each call with the next status, and the last one forever. */
const statuses = (opts: { sequence: Array<number | 'network-error'> }) => {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  const fetchFn = async (url: string, init?: { method?: string }) => {
    const step = opts.sequence[Math.min(calls.length, opts.sequence.length - 1)];
    calls.push({ url, method: init?.method });
    if (step === 'network-error') {
      throw new Error('socket closed');
    }
    return { ok: step >= 200 && step < 300, status: step };
  };
  return { fetchFn, calls };
};

describe('tarballUrl', () => {
  test('names the tarball file by the unscoped name and the version', () => {
    expect(tarballUrl({ packageName: '@venizia/ardor-kernel', version: '0.1.4-4' })).toBe(
      'https://registry.npmjs.org/@venizia/ardor-kernel/-/ardor-kernel-0.1.4-4.tgz',
    );
  });

  test('handles an unscoped package', () => {
    expect(tarballUrl({ packageName: 'left-pad', version: '1.3.0' })).toBe(
      'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz',
    );
  });
});

describe('waitForTarball', () => {
  const fast = { sleepFn: async () => {}, intervalMs: 1 };

  test('polls the tarball URL until it answers 200', async () => {
    const { fetchFn, calls } = statuses({ sequence: [404, 404, 200] });

    await waitForTarball({
      packageName: '@venizia/ardor-kernel',
      version: '0.1.4-4',
      fetchFn,
      ...fast,
    });

    expect(calls).toHaveLength(3);
    expect(calls.every(call => call.url.endsWith('/ardor-kernel/-/ardor-kernel-0.1.4-4.tgz'))).toBe(
      true,
    );
  });

  test('a network error is not an answer: it polls again', async () => {
    const { fetchFn, calls } = statuses({ sequence: ['network-error', 200] });

    await waitForTarball({ packageName: 'a', version: '1.0.0', fetchFn, ...fast });

    expect(calls).toHaveLength(2);
  });

  test('sleeps between polls, and not after the answer', async () => {
    const { fetchFn } = statuses({ sequence: [404, 404, 200] });
    const slept: number[] = [];

    await waitForTarball({
      packageName: 'a',
      version: '1.0.0',
      fetchFn,
      intervalMs: 7,
      sleepFn: async ms => {
        slept.push(ms);
      },
    });

    expect(slept).toEqual([7, 7]);
  });

  test('throws, naming the package and version, when it never answers 200', async () => {
    const { fetchFn, calls } = statuses({ sequence: [404] });

    const error = await waitForTarball({
      packageName: '@venizia/ardor-react',
      version: '0.1.4-4',
      fetchFn,
      attempts: 4,
      ...fast,
    }).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(String(error)).toContain('@venizia/ardor-react@0.1.4-4');
    expect(calls).toHaveLength(4);
  });
});

// release.ts runs `main()` on import, so the wiring is checked in its source: the chain must wait
// for the tarball after the registry lists the version and before it moves to the next package.
describe('release.ts', () => {
  test('waits for the tarball between the publish check and the next package', async () => {
    const source = await Bun.file(`${import.meta.dir}/../release.ts`).text();

    const published = source.indexOf('await assertPublished({ state })');
    const tarball = source.indexOf('await waitForTarball({');
    const pulled = source.indexOf("command: ['git', 'pull', '--ff-only'");

    expect(published).toBeGreaterThan(-1);
    expect(tarball).toBeGreaterThan(published);
    expect(pulled).toBeGreaterThan(tarball);
  });
});
