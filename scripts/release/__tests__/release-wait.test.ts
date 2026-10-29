import { describe, expect, test } from 'bun:test';
import { tarballUrl, waitForCompletion, waitForTarball } from '../release-wait';

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
    expect(
      calls.every((call) => call.url.endsWith('/ardor-kernel/-/ardor-kernel-0.1.4-4.tgz')),
    ).toBe(true);
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
      sleepFn: async (ms) => {
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

// The wiring of release.ts is checked in its source: one dispatch, then the end of the run, then the
// registry for every package, then one pull. The wait for each tarball is the chain's (release-chain.ts).
describe('release.ts', () => {
  test('dispatches once, waits for the run, then verifies the registry and pulls', async () => {
    const source = await Bun.file(`${import.meta.dir}/../release.ts`).text();

    const dispatched = source.indexOf('ReleasePlan.dispatchArgs({');
    const finished = source.indexOf('await waitForRunCompletion({');
    const verified = source.indexOf('await ReleaseVerify.verifyRun({');
    const pulled = source.indexOf("command: ['git', 'pull', '--ff-only'");

    expect(dispatched).toBeGreaterThan(-1);
    expect(finished).toBeGreaterThan(dispatched);
    expect(verified).toBeGreaterThan(finished);
    expect(pulled).toBeGreaterThan(verified);
    expect(source.split('ReleasePlan.dispatchArgs({')).toHaveLength(2);
    expect(source).not.toContain('waitForTarball');
  });
});

// The release job waits for a person to approve it, so a run can sit in `waiting` for as long as that
// takes; the driver must not give up on it and must tell the operator what it waits for.
describe('waitForCompletion', () => {
  const run = (opts: { statuses: Array<{ status: string; conclusion: string }> }) => {
    let polls = 0;
    const readRun = async () => {
      const step = opts.statuses[Math.min(polls, opts.statuses.length - 1)]!;
      polls += 1;
      return step;
    };

    return { readRun, polls: () => polls };
  };
  const noSleep = async () => {};

  test('returns the conclusion of a run that completes', async () => {
    const { readRun } = run({
      statuses: [
        { status: 'queued', conclusion: '' },
        { status: 'in_progress', conclusion: '' },
        { status: 'completed', conclusion: 'success' },
      ],
    });

    expect(await waitForCompletion({ runId: '1', readRun, sleepFn: noSleep })).toBe('success');
  });

  test('keeps waiting while the run waits for approval, however long', async () => {
    const waiting = Array.from({ length: 2000 }, () => ({ status: 'waiting', conclusion: '' }));
    const { readRun, polls } = run({
      statuses: [...waiting, { status: 'completed', conclusion: 'success' }],
    });

    expect(await waitForCompletion({ runId: '1', readRun, sleepFn: noSleep })).toBe('success');
    expect(polls()).toBe(2001);
  });

  test('reports the wait when it starts and then now and then, never on every poll', async () => {
    const waiting = Array.from({ length: 70 }, () => ({ status: 'waiting', conclusion: '' }));
    const { readRun } = run({
      statuses: [...waiting, { status: 'completed', conclusion: 'failure' }],
    });
    const reports: number[] = [];

    await waitForCompletion({
      runId: '9',
      readRun,
      sleepFn: noSleep,
      onWaiting: ({ polls }) => reports.push(polls),
    });

    expect(reports).toEqual([1, 31, 61]);
  });

  test('says nothing for a run that never waits', async () => {
    const { readRun } = run({ statuses: [{ status: 'completed', conclusion: 'success' }] });
    const reports: number[] = [];

    await waitForCompletion({
      runId: '9',
      readRun,
      sleepFn: noSleep,
      onWaiting: ({ polls }) => reports.push(polls),
    });

    expect(reports).toEqual([]);
  });
});
