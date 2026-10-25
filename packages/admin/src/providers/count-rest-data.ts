import type { RaRecord } from 'ra-core';

import { RequestMethods, RequestTypes, type TRequestType } from '@venizia/ardor-kernel';
import type { TExtraRequest } from '@venizia/ignis-kernel/repository';
import type { IListFilter } from './list-filter';
import { DefaultRestDataProvider } from './rest-data';

export class CountRestDataProvider<
  TResource extends string = string,
> extends DefaultRestDataProvider<TResource> {
  protected override requestList<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, unknown>;
    filter: IListFilter;
    extra?: TExtraRequest;
  }) {
    const { resource, queryKey, filter } = opts;

    // The base class reads the rows and keeps the route's list extras as `meta.extra`.
    const list = super.requestList<RecordType>(opts);

    // The count route has no extras: its request carries none.
    const count = this.request<{ count?: number }>({
      resource,
      type: RequestTypes.SEND,
      method: RequestMethods.GET,
      paths: [resource, 'count'],
      query: { ...queryKey, where: filter?.where },
    });

    return Promise.all([list, count]).then(([listResult, countResult]) => {
      return {
        data: listResult.data,
        total: countResult?.data?.count ?? 0,
        ...('meta' in listResult && listResult.meta ? { meta: listResult.meta } : {}),
      };
    });
  }
}
