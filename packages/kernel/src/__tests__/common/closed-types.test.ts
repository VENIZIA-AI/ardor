import { describe, expect, test } from 'bun:test';
import type { IApplicationInfo, INetworkResponse, ISendParams } from '@/common';

describe('request types name every field they accept', () => {
  test('ISendParams takes its named fields, and a typo is a compile error', () => {
    const params: ISendParams = {
      method: 'POST',
      payload: { data: 'plain text' },
      query: { page: 2, tags: ['a', 'b'] },
      headers: { 'x-tenant': 't1', 'x-retries': 3 },
    };
    // @ts-expect-error - `bdy` is not a field: it used to compile and be dropped
    const typo: ISendParams = { method: 'GET', bdy: {} };

    expect(params.method).toBe('POST');
    expect(typo.method).toBe('GET');
  });

  test('the removed body fields and a payload with no data are compile errors', () => {
    // @ts-expect-error - `body` was replaced by `payload`
    const body: ISendParams = { method: 'POST', body: { data: 1 } };
    // @ts-expect-error - `bodyType` was replaced by `payload.type`
    const bodyType: ISendParams = { method: 'POST', bodyType: 'json' };
    // @ts-expect-error - an old payload object is no `payload`: it has no `data`
    const bare: ISendParams = { method: 'POST', payload: { year: 2026 } };

    expect([body.method, bodyType.method, bare.method]).toEqual(['POST', 'POST', 'POST']);
  });

  test('ISendParams names the list extras that send() passes on', () => {
    const params: ISendParams = { method: 'GET', extra: { facets: ['status'] } as never };

    expect(params.extra).toBeDefined();
  });

  test('IApplicationInfo requires name, version and description, and takes keys of your own', () => {
    const info: IApplicationInfo = { name: 'app', version: '1.0.0', description: 'x', build: 7 };
    // @ts-expect-error - `name` is required
    const unnamed: IApplicationInfo = { version: '1', description: 'x' };
    // @ts-expect-error - `id` is a string
    const numbered: IApplicationInfo = { name: 'app', version: '1', description: 'x', id: 7 };

    expect(info.build).toBe(7);
    expect(unnamed.version).toBe('1');
    expect(numbered.name).toBe('app');
  });

  test('INetworkResponse is closed: a field it does not name is refused', () => {
    const response: INetworkResponse<number> = { data: 1, total: 4, count: 2 };
    // @ts-expect-error - `rows` is not a field of the response
    const typo: INetworkResponse = { data: [], rows: 1 };

    expect(response.total).toBe(4);
    expect(typo.data).toEqual([]);
  });
});
