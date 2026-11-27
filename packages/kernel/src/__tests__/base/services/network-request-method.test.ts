import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { HTTP } from '@venizia/ignis-helpers/common';

import { RequestTypes } from '@/common';
import { DefaultNetworkRequestService } from '@/base/services/network-request';

const createService = () =>
  new DefaultNetworkRequestService({
    name: 'method-test',
    baseUrl: 'https://api.test',
    noAuth: { regex: /./ },
  });

describe('the method of a request', () => {
  let restore: (() => void) | undefined;

  afterEach(() => restore?.());

  /** What `fetch` is handed: a browser uppercases most methods, not `patch`. */
  const send = async (opts: {
    method: Parameters<DefaultNetworkRequestService['doRequest']>[0]['method'];
    body?: string;
  }) => {
    const spy = spyOn(globalThis, 'fetch').mockImplementation(
      Object.assign(async () => Response.json({ ok: true }), { preconnect: () => {} }),
    );
    restore = () => spy.mockRestore();

    await createService().doRequest({ ...opts, type: RequestTypes.SEND, paths: ['products'] });

    const [input, init] = spy.mock.calls[0];

    return input instanceof Request ? input : new Request(input, init);
  };

  test.each([HTTP.Methods.PATCH, 'patch', 'PATCH'] as const)(
    'doRequest hands %s to fetch in uppercase',
    async (method) => {
      const spy = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(async () => Response.json({ ok: true }), { preconnect: () => {} }),
      );
      restore = () => spy.mockRestore();

      await createService().doRequest({ method, type: RequestTypes.SEND, paths: ['products'] });

      expect(spy.mock.calls[0][1]?.method).toBe('PATCH');
    },
  );

  test('a lowercase get sends no body', async () => {
    const request = await send({ method: HTTP.Methods.GET, body: '{}' });

    expect(request.method).toBe('GET');
    expect(request.body).toBeNull();
  });

  test('toWireMethod answers the uppercase method', () => {
    expect(DefaultNetworkRequestService.toWireMethod({ method: HTTP.Methods.PATCH })).toBe('PATCH');
    expect(DefaultNetworkRequestService.toWireMethod({ method: 'DELETE' })).toBe('DELETE');
  });
});
