import { describe, expect, mock, test, afterEach } from 'bun:test';
import { AuthRecoveryHelper } from '@/helpers';
import { LogWatch } from '../../log-watch';

afterEach(() => LogWatch.restore());

const create = (opts: {
  refresh?: () => Promise<boolean>;
  onFailure?: () => Promise<void>;
  refreshTokenPath?: string;
  noAuth?: (paths: string[]) => boolean;
}) => {
  const refresh = mock(opts.refresh ?? (() => Promise.resolve(true)));
  const onFailure = mock(opts.onFailure ?? (() => Promise.resolve()));
  const recovery = new AuthRecoveryHelper({
    getRefreshTokenPath: () => opts.refreshTokenPath,
    refresh,
    onFailure,
    isNoAuthPath: opts.noAuth ?? (() => false),
  });

  return { recovery, refresh, onFailure };
};

describe('AuthRecoveryHelper.refresh', () => {
  test('a caller of another session starts its own refresh, and callers of one session share one', async () => {
    const { recovery, refresh } = create({});

    const results = await Promise.all([
      recovery.refresh({ key: 'alice' }),
      recovery.refresh({ key: 'alice' }),
      recovery.refresh({ key: 'bob' }),
    ]);

    expect(results).toEqual([true, true, true]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test('every caller in flight shares one refresh, and the next burst makes a new one', async () => {
    let release: (value: boolean) => void = () => {};

    let started = 0;
    const { recovery, refresh } = create({
      // Only the first refresh is held open; a later one settles at once.
      refresh: () => {
        return started++ === 0
          ? new Promise<boolean>((resolve) => (release = resolve))
          : Promise.resolve(true);
      },
    });

    const callers = [recovery.refresh(), recovery.refresh(), recovery.refresh()];
    // The refresh starts on a microtask, so the resolver exists one tick later.
    await new Promise((resolve) => setTimeout(resolve, 0));
    release(true);

    const result = await Promise.all(callers);
    expect(result).toEqual([true, true, true]);
    expect(refresh).toHaveBeenCalledTimes(1);

    await recovery.refresh();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test('false from the refresh is no refresh, not a failure', async () => {
    const { recovery, onFailure } = create({ refresh: () => Promise.resolve(false) });

    const result = await recovery.refresh();
    expect(result).toBe(false);
    expect(onFailure).not.toHaveBeenCalled();
  });

  test('a refresh that rejects runs onFailure once and answers false', async () => {
    const logged = LogWatch.on({ scope: 'AuthRecoveryHelper', method: 'error' });

    const { recovery, onFailure } = create({ refresh: () => Promise.reject(new Error('expired')) });

    const result = await Promise.all([recovery.refresh(), recovery.refresh()]);
    expect(result).toEqual([false, false]);
    expect(onFailure).toHaveBeenCalledTimes(1);

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('[refresh] refreshToken failed'),
      expect.objectContaining({ message: 'expired' }),
    );
  });

  test('a refresh that throws before it returns a promise is still a failed refresh', async () => {
    const logged = LogWatch.on({ scope: 'AuthRecoveryHelper', method: 'error' });

    const { recovery, onFailure } = create({
      refresh: () => {
        throw new Error('sync');
      },
    });

    const result = await recovery.refresh();
    expect(result).toBe(false);
    expect(onFailure).toHaveBeenCalledTimes(1);

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('[refresh] refreshToken failed'),
      expect.objectContaining({ message: 'sync' }),
    );
  });

  test('an onFailure that throws does not escape', async () => {
    const logged = LogWatch.on({ scope: 'AuthRecoveryHelper', method: 'error' });

    const { recovery } = create({
      refresh: () => Promise.reject(new Error('no')),
      onFailure: () => Promise.reject(new Error('hook failed')),
    });

    const result = await recovery.refresh();
    expect(result).toBe(false);

    expect(logged).toHaveBeenCalledTimes(2);
    expect(logged).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('[refresh] refreshToken failed'),
      expect.objectContaining({ message: 'no' }),
    );
    expect(logged).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('[refresh] onAuthFailure failed'),
      expect.objectContaining({ message: 'hook failed' }),
    );
  });
});

describe('AuthRecoveryHelper.canRecover', () => {
  test('is true for an ordinary path', () => {
    expect(create({}).recovery.canRecover({ paths: ['orders', '7'] })).toBe(true);
  });

  test('is false for a no-auth path, asked with the resource and the paths', () => {
    const noAuth = mock((_paths: string[]) => true);
    const { recovery } = create({ noAuth });

    expect(recovery.canRecover({ paths: ['auth', 'sign-in'] })).toBe(false);
    expect(noAuth).toHaveBeenCalledWith(['auth', 'sign-in']);
  });

  test('is false for the refresh path itself, which would wait on itself', () => {
    const { recovery } = create({ refreshTokenPath: '/auth/refresh' });

    expect(recovery.canRecover({ paths: ['/auth/refresh'] })).toBe(false);
    expect(recovery.canRecover({ paths: ['/auth', '/refresh'] })).toBe(true);
    expect(recovery.canRecover({ paths: ['/orders'] })).toBe(true);
  });
});
