import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { RejectionUtility } from '@venizia/dev-configs/testing';
import { isApplicationError } from '@venizia/ignis-inversion';

import { DefaultAuthService } from '@/base/services/auth';
import {
  DefaultNetworkRequestService,
  NETWORK_TIMEOUT_CODE,
} from '@/base/services/network-request';
import { RequestMethods, RequestTypes, type TRequestTimeoutOptions } from '@/common';
import { FakeStorage } from '@/testing';
import { LogWatch } from '@/__tests__/support/log-watch';

afterEach(() => LogWatch.restore());

const SLOW_MS = 400;
const REFRESH_PATH = '/auth/refresh';
const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

const nameOf = (error: unknown): string | undefined => {
  return error instanceof Error || error instanceof DOMException ? error.name : undefined;
};

const codeOf = (error: unknown): string | undefined => {
  return isApplicationError(error) ? error.normalized.code : undefined;
};

describe('DefaultNetworkRequestService, abort and timeout', () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = '';
  let refreshDelay = 0;
  let refreshStatus = 200;
  const requested: Array<{ pathname: string; authorization: string | null }> = [];

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: async (req: Request): Promise<Response> => {
        const url = new URL(req.url);
        const authorization = req.headers.get('authorization');
        requested.push({ pathname: url.pathname, authorization });

        if (url.pathname === '/slow') {
          await Bun.sleep(SLOW_MS);

          return Response.json({ data: 'slow' });
        }

        if (url.pathname === REFRESH_PATH) {
          await Bun.sleep(refreshDelay);

          if (refreshStatus !== 200) {
            return Response.json({ error: 'refused' }, { status: refreshStatus });
          }

          return Response.json({ token: { value: 'fresh', type: 'Bearer' } });
        }

        if (url.pathname === '/guarded') {
          return authorization === 'Bearer fresh'
            ? Response.json({ data: 'ok' })
            : Response.json({ error: 'expired' }, { status: 401 });
        }

        return Response.json({ data: 'fast' });
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.stop(true);
  });

  let authService: DefaultAuthService;

  beforeEach(() => {
    requested.length = 0;
    refreshDelay = 0;
    refreshStatus = 200;
    Object.defineProperty(globalThis, 'localStorage', {
      value: new FakeStorage(),
      configurable: true,
      writable: true,
    });
    authService = new DefaultAuthService();
    authService.saveAuth({
      userId: 7,
      username: 'alice',
      token: { value: 'stale', type: 'Bearer' },
      roles: [],
    });
  });

  afterEach(() => {
    if (originalLocal) {
      Object.defineProperty(globalThis, 'localStorage', originalLocal);
    }
  });

  const createService = (opts: { timeout?: TRequestTimeoutOptions } = {}) => {
    return new DefaultNetworkRequestService({
      name: 'abort-test',
      baseUrl,
      authRecovery: { refreshTokenPath: REFRESH_PATH },
      authService,
      timeout: opts.timeout,
    });
  };

  const get = (opts: {
    service: DefaultNetworkRequestService;
    path: string;
    signal?: AbortSignal;
  }) => {
    const { service, path, signal } = opts;

    return service.doRequest<{ data: string }>({
      paths: [path],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      headers: service.getRequestHeader({ resource: path }),
      signal,
    });
  };

  test('an aborted request rejects with the abort, long before the server answers', async () => {
    const controller = new AbortController();
    const startedAt = performance.now();
    setTimeout(() => controller.abort(), 20);

    const error = await RejectionUtility.rejectionOf({
      task: get({ service: createService(), path: 'slow', signal: controller.signal }),
    });

    expect(nameOf(error)).toBe('AbortError');
    expect(error).toBe(controller.signal.reason);
    expect(performance.now() - startedAt).toBeLessThan(SLOW_MS / 2);
  });

  test('a signal aborted before the call sends nothing and is not a 401', async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await RejectionUtility.rejectionOf({
      task: get({ service: createService(), path: 'guarded', signal: controller.signal }),
    });

    expect(nameOf(error)).toBe('AbortError');
    expect(requested.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(0);
    expect(requested.filter((entry) => entry.pathname === '/guarded')).toHaveLength(0);
  });

  test('a request that outlives the timeout rejects with a 504 that names the path and the milliseconds', async () => {
    const startedAt = performance.now();
    const error = await RejectionUtility.rejectionOf({
      task: get({
        service: createService({ timeout: { use: true, milliseconds: 50 } }),
        path: 'slow',
      }),
    });

    expect(codeOf(error)).toBe(NETWORK_TIMEOUT_CODE);
    expect(isApplicationError(error) ? error.statusCode : undefined).toBe(504);
    expect(error instanceof Error ? error.message : '').toContain('slow');
    expect(error instanceof Error ? error.message : '').toContain('50 ms');
    expect(performance.now() - startedAt).toBeLessThan(SLOW_MS / 2);
  });

  test('a user abort with a timeout on rejects with the abort, not the timeout code', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const error = await RejectionUtility.rejectionOf({
      task: get({
        service: createService({ timeout: { use: true, milliseconds: 200 } }),
        path: 'slow',
        signal: controller.signal,
      }),
    });

    expect(nameOf(error)).toBe('AbortError');
    expect(codeOf(error)).not.toBe(NETWORK_TIMEOUT_CODE);
  });

  test('a request that answers in time is unaffected by the timeout', async () => {
    const response = await get({
      service: createService({ timeout: { use: true, milliseconds: 200 } }),
      path: 'fast',
      signal: new AbortController().signal,
    });

    expect(response.data).toEqual({ data: 'fast' });
  });

  test('with no timeout configured a slow request still answers', async () => {
    const response = await get({ service: createService(), path: 'slow' });

    expect(response.data).toEqual({ data: 'slow' });
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'a timeout of %p milliseconds is refused when the service is built',
    (milliseconds) => {
      expect(() => createService({ timeout: { use: true, milliseconds } })).toThrow('milliseconds');
    },
  );

  test('a timeout that is off takes no milliseconds', () => {
    expect(() => createService({ timeout: { use: false } })).not.toThrow();
  });

  test('aborting a call while a refresh that then fails is in flight rejects with the abort, not the 401', async () => {
    const logged = LogWatch.on({ scope: 'AuthRecoveryHelper', method: 'error' });
    const refreshEnded = new Promise<void>((resolve) => {
      logged.mockImplementation(() => resolve());
    });

    refreshDelay = 120;
    refreshStatus = 500;
    const controller = new AbortController();

    const aborted = RejectionUtility.rejectionOf({
      task: get({ service: createService(), path: 'guarded', signal: controller.signal }),
    });

    await Bun.sleep(40);
    controller.abort();

    const error = await aborted;

    expect(nameOf(error)).toBe('AbortError');
    expect(codeOf(error)).toBeUndefined();

    // The abort leaves the refresh running; it has to fail before this test ends.
    await refreshEnded;
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('[refresh] refreshToken failed'),
      expect.objectContaining({ message: 'HTTP 500' }),
    );
  });

  test('an abort that arrives while the refresh hangs rejects at once, with no timeout to end the wait', async () => {
    refreshDelay = 1500;
    const controller = new AbortController();
    const startedAt = performance.now();

    const aborted = RejectionUtility.rejectionOf({
      task: get({ service: createService(), path: 'guarded', signal: controller.signal }),
    });

    await Bun.sleep(40);
    controller.abort();
    const error = await aborted;

    expect(nameOf(error)).toBe('AbortError');
    expect(performance.now() - startedAt).toBeLessThan(800);
  });

  test('aborting a call whose 401 started the refresh leaves the refresh running and the other caller unaffected', async () => {
    refreshDelay = 120;
    const service = createService();
    const controller = new AbortController();

    const aborted = RejectionUtility.rejectionOf({
      task: get({ service, path: 'guarded', signal: controller.signal }),
    });
    const other = get({ service, path: 'guarded' });

    // Both 401s have arrived and joined the one refresh by now.
    await Bun.sleep(40);
    controller.abort();

    const [abortError, otherResponse] = await Promise.all([aborted, other]);

    expect(nameOf(abortError)).toBe('AbortError');
    expect(otherResponse.data).toEqual({ data: 'ok' });
    expect(requested.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(1);
    expect(authService.getAuth()?.value).toBe('fresh');
    // Only the caller still waiting sends the retry.
    expect(
      requested.filter(
        (entry) => entry.pathname === '/guarded' && entry.authorization === 'Bearer fresh',
      ),
    ).toHaveLength(1);
  });
});
