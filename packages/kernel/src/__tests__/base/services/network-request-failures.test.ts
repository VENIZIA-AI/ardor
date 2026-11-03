import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { DefaultNetworkRequestService } from '@/base/services/network-request';
import { type IAuthTokenRecord, LocalStorageKeys, RequestCountData, RequestTypes } from '@/common';

type TConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

/** Every console call made while `run` executes, with an Error shown as its name and message. */
const captureConsole = async (run: () => unknown): Promise<string> => {
  const methods: TConsoleMethod[] = ['log', 'info', 'warn', 'error', 'debug'];
  const spies = methods.map((method) => spyOn(console, method).mockImplementation(() => undefined));

  try {
    await run();

    return JSON.stringify(
      spies.flatMap((spy) => spy.mock.calls),
      (_key, value) => (value instanceof Error ? `${value.name}: ${value.message}` : value),
    );
  } finally {
    for (const spy of spies) {
      spy.mockRestore();
    }
  }
};

class FailingRefreshService extends DefaultNetworkRequestService {
  refreshError: unknown = new Error('refresh-boom');
  failureError: unknown;

  protected override async refreshToken(): Promise<boolean> {
    throw this.refreshError;
  }

  protected override async onAuthFailure(): Promise<void> {
    if (this.failureError) {
      throw this.failureError;
    }
  }

  protected override resolveAuthToken(): IAuthTokenRecord | undefined {
    return { value: 'token', type: 'Bearer' };
  }
}

const createFailingService = (opts: { name: string }) =>
  new FailingRefreshService({
    name: opts.name,
    baseUrl: 'http://127.0.0.1:1',
    authRecovery: { refreshTokenPath: '/auth/refresh' },
  });

afterEach(() => {
  localStorage.clear();
});

describe('convertResponse on a body that is not an object', () => {
  test.each([
    ['null', null],
    ['a string', 'text'],
    ['a number', 42],
    ['undefined', undefined],
  ])('%s with requestCountData=1 throws the documented error, not a TypeError', (_name, data) => {
    const service = createFailingService({ name: 'convert-response-test' });
    let thrown: unknown;

    try {
      service.convertResponse({
        type: RequestTypes.GET_LIST,
        requestCountData: RequestCountData.DATA_WITH_COUNT,
        response: { data: data as never, headers: new Headers() },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toContain('Invalid response format');
  });
});

describe('errors the network service used to swallow', () => {
  test('a failed refresh logs the error that made it fail', async () => {
    const service = createFailingService({ name: 'refresh-failure-test' });

    const logged = await captureConsole(async () => {
      const result = await service.refresh();
      expect(result).toBe(false);
    });

    expect(logged).toContain('refresh-boom');
  });

  test('a failing onAuthFailure logs its error too', async () => {
    const service = createFailingService({ name: 'auth-failure-test' });
    service.failureError = new Error('failure-boom');

    const logged = await captureConsole(async () => {
      const result = await service.refresh();
      expect(result).toBe(false);
    });

    expect(logged).toContain('refresh-boom');
    expect(logged).toContain('failure-boom');
  });

  test('an invalid noAuthPathRegex pattern logs the pattern and the error', async () => {
    const logged = await captureConsole(() => {
      return new DefaultNetworkRequestService({
        name: 'bad-regex-test',
        baseUrl: 'http://127.0.0.1:1',
        noAuthPathRegex: ['('],
      });
    });

    expect(logged).toContain('noAuthPathRegex');
    expect(logged).toContain('SyntaxError');
  });

  test('a stored token that is not JSON is ignored, logged by error name, and never quoted', async () => {
    localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, 'eyJhbGciOiJIUzI1NiJ9.secretpart');
    let token: unknown = 'unset';

    const logged = await captureConsole(() => {
      token = DefaultNetworkRequestService.readAuthTokenFromStorage();
    });

    expect(token).toBeUndefined();
    expect(logged).toContain('SyntaxError');
    expect(logged).not.toContain('secretpart');
    expect(logged).not.toContain('eyJhbGci');
  });
});
