import { describe, expect, test } from 'bun:test';
import { HTTP, type THttpMethod } from '@venizia/ignis-helpers/common';

import type { IRestRequestOptions } from '@/common';
import { DefaultRestDataProvider } from '@/providers/rest-data';

const options = { url: 'https://api.test', noAuth: { regex: /./ } };
const info = { name: 'method-test', version: '1.0.0', description: 'test' };

/** Records what an override of `request` is handed. */
class RecordingProvider extends DefaultRestDataProvider {
  readonly methods: Array<THttpMethod> = [];

  protected override request(opts: IRestRequestOptions) {
    this.methods.push(opts.method);

    return Promise.resolve({ data: [] });
  }
}

describe('the method an override is handed', () => {
  test('every react-admin method hands request() an uppercase method', async () => {
    const provider = new RecordingProvider(options, info);
    const resource = 'products';
    const pagination = { page: 1, perPage: 1 };
    const sort = { field: 'id', order: 'ASC' } as const;

    await provider.getList({ resource, params: { pagination, sort, filter: {} } });
    await provider.getOne({ resource, params: { id: 1 } });
    await provider.getMany({ resource, params: { ids: [1] } });
    await provider.getManyReference({
      resource,
      params: { target: 'shopId', id: 1, pagination, sort, filter: {} },
    });
    await provider.update({ resource, params: { id: 1, data: {}, previousData: { id: 1 } } });
    await provider.updateMany({ resource, params: { ids: [1], data: {} } });
    await provider.create({ resource, params: { data: {} } });
    await provider.delete({ resource, params: { id: 1 } });
    await provider.deleteMany({ resource, params: { ids: [1] } });

    expect(provider.methods).toEqual([
      'GET',
      'GET',
      'GET',
      'GET',
      'PATCH',
      'PATCH',
      'POST',
      'DELETE',
      'DELETE',
    ]);
  });

  test('send hands request() the method in uppercase', async () => {
    const provider = new RecordingProvider(options, info);

    await provider.send({ resource: 'products', params: { method: HTTP.Methods.PATCH } });

    expect(provider.methods).toEqual(['PATCH']);
  });
});
