import { describe, expect, mock, test } from 'bun:test';
import { AuthRecovery, Logger } from '@/helpers';

const logger = Logger.getInstance({ scope: 'auth-recovery-test' });

const create = (opts: {
  refresh?: () => Promise<boolean>;
  onFailure?: () => Promise<void>;
  refreshTokenPath?: string;
  noAuth?: (paths: string[]) => boolean;
}) => {
  const refresh = mock(opts.refresh ?? (() => Promise.resolve(true)));
  const onFailure = mock(opts.onFailure ?? (() => Promise.resolve()));
  const recovery = new AuthRecovery({
    logger,
    getRefreshTokenPath: () => opts.refreshTokenPath,
    refresh,
    onFailure,
    isNoAuthPath: opts.noAuth ?? (() => false),
  });

  return { recovery, refresh, onFailure };
};

describe('AuthRecovery.refresh', () => {
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

    expect(await Promise.all(callers)).toEqual([true, true, true]);
    expect(refresh).toHaveBeenCalledTimes(1);

    await recovery.refresh();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test('false from the refresh is no refresh, not a failure', async () => {
    const { recovery, onFailure } = create({ refresh: () => Promise.resolve(false) });

    expect(await recovery.refresh()).toBe(false);
    expect(onFailure).not.toHaveBeenCalled();
  });

  test('a refresh that rejects runs onFailure once and answers false', async () => {
    const { recovery, onFailure } = create({ refresh: () => Promise.reject(new Error('expired')) });

    expect(await Promise.all([recovery.refresh(), recovery.refresh()])).toEqual([false, false]);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  test('a refresh that throws before it returns a promise is still a failed refresh', async () => {
    const { recovery, onFailure } = create({
      refresh: () => {
        throw new Error('sync');
      },
    });

    expect(await recovery.refresh()).toBe(false);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  test('an onFailure that throws does not escape', async () => {
    const { recovery } = create({
      refresh: () => Promise.reject(new Error('no')),
      onFailure: () => Promise.reject(new Error('hook failed')),
    });

    expect(await recovery.refresh()).toBe(false);
  });
});

describe('AuthRecovery.canRecover', () => {
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
