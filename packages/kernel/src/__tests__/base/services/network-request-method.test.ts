import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { RejectionUtility } from '@venizia/dev-configs/testing';
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

    return spy.mock.calls[0][1];
  };

  test.each([HTTP.Methods.PATCH, 'PATCH'] as const)(
    'doRequest hands %s to fetch in uppercase',
    async (method) => {
      const handed = await send({ method });

      expect(handed?.method).toBe('PATCH');
    },
  );

  test('a lowercase get sends no body', async () => {
    const handed = await send({ method: HTTP.Methods.GET, body: '{}' });

    expect(handed?.method).toBe('GET');
    expect(handed?.body ?? undefined).toBeUndefined();
  });

  test('toWireMethod answers the uppercase method', () => {
    expect(DefaultNetworkRequestService.toWireMethod({ method: HTTP.Methods.PATCH })).toBe('PATCH');
    expect(DefaultNetworkRequestService.toWireMethod({ method: 'DELETE' })).toBe('DELETE');
  });

  test.each(['foo', '', undefined])('toWireMethod refuses %p by name', (method) => {
    expect(() =>
      // @ts-expect-error what an untyped caller can pass
      DefaultNetworkRequestService.toWireMethod({ method }),
    ).toThrow('[toWireMethod] Not an HTTP method');
  });

  test('doRequest without a method is refused by name, and nothing is sent', async () => {
    const spy = spyOn(globalThis, 'fetch');
    restore = () => spy.mockRestore();
    // @ts-expect-error an untyped caller leaves the method out
    const task = createService().doRequest({ type: RequestTypes.SEND, paths: ['products'] });

    const refusal = await RejectionUtility.rejectionOf({ task });

    expect(String(refusal)).toContain('[toWireMethod] Not an HTTP method');
    expect(spy).not.toHaveBeenCalled();
  });
});
