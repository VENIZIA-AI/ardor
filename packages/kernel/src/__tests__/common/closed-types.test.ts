import { describe, expect, test } from 'bun:test';
import type { IApplicationInfo, INetworkResponse, ISendParams } from '@/common';

describe('request types name every field they accept', () => {
  test('ISendParams takes its named fields, and a typo is a compile error', () => {
    const params: ISendParams = {
      method: 'POST',
      body: 'plain text',
      query: { page: 2, tags: ['a', 'b'] },
      headers: { 'x-tenant': 't1', 'x-retries': 3 },
    };
    // @ts-expect-error - `bdy` is not a field: it used to compile and be dropped
    const typo: ISendParams = { method: 'GET', bdy: {} };

    expect(params.method).toBe('POST');
    expect(typo.method).toBe('GET');
  });

  test('ISendParams names the list extras that send() passes on', () => {
    const params: ISendParams = { method: 'GET', extra: { facets: ['status'] } as never };

    expect(params.extra).toBeDefined();
  });

  test('IApplicationInfo takes name, version, description and author, and no other key', () => {
    const info: IApplicationInfo = {
      name: 'app',
      version: '1.0.0',
      description: 'x',
      author: { name: 'a', email: 'a@x.dev' },
    };
    // @ts-expect-error - an unknown key is an error, not a silent extra
    const extra: IApplicationInfo = { name: 'app', version: '1', description: 'x', build: 7 };

    expect(info.name).toBe('app');
    expect(extra.name).toBe('app');
  });

  test('INetworkResponse is closed: a field it does not name is refused', () => {
    const response: INetworkResponse<number> = { data: 1, total: 4, count: 2 };
    // @ts-expect-error - `rows` is not a field of the response
    const typo: INetworkResponse = { data: [], rows: 1 };

    expect(response.total).toBe(4);
    expect(typo.data).toEqual([]);
  });
});
