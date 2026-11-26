import { RecordUtility } from '@venizia/ignis-helpers/core';
import type { RaRecord } from 'ra-core';

import { RequestMethods, RequestTypes, type TRequestType } from '@venizia/ardor-kernel';
import type { TExtraRequest } from '@venizia/ignis-kernel/repository';
import type { IListFilter } from './list-filter';
import { DefaultRestDataProvider } from './rest-data';

/**
 * A `DefaultRestDataProvider` whose list reads take their `total` from the count route
 * (`GET /{resource}/count` with the same `where`) instead of the `Content-Range` header.
 */
export class CountRestDataProvider<
  TResource extends string = string,
> extends DefaultRestDataProvider<TResource> {
  /**
   * Sends the list GET and the count GET together; `total` is the count's `count`, or `0` when the
   * count answers none or no number. Rejects when either request rejects.
   */
  protected override requestList<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, unknown>;
    filter: IListFilter;
    extra?: TExtraRequest;
    signal?: AbortSignal;
  }) {
    const { resource, queryKey, filter, signal } = opts;

    // The base class reads the rows and keeps the route's list extras as `meta.extra`.
    const list = super.requestList<RecordType>(opts);

    // The count route has no extras: its request carries none.
    const count = this.request({
      resource,
      type: RequestTypes.SEND,
      method: RequestMethods.GET,
      paths: [resource, 'count'],
      query: { ...queryKey, where: filter?.where },
      signal,
    });

    return Promise.all([list, count]).then(([listResult, countResult]) => {
      const counted = RecordUtility.read({ value: countResult.data, path: ['count'] });

      return {
        data: listResult.data,
        total: typeof counted === 'number' ? counted : 0,
        ...('meta' in listResult && listResult.meta ? { meta: listResult.meta } : {}),
      };
    });
  }
}
