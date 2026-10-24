import type { RaRecord } from 'ra-core';

import {
  type AnyType,
  RequestCountData,
  RequestTypes,
  type TRequestMethod,
  type TRequestType,
} from '@venizia/ardor-kernel';
import { HttpExtraRequest } from '@venizia/ignis-kernel/repository';
import { DefaultRestDataProvider } from './rest-data';

/** The headers of the list request without the list-extras header: the count route has no extras. */
const withoutExtraHeader = (headers?: HeadersInit): HeadersInit | undefined => {
  if (!headers) {
    return headers;
  }

  const extraHeader = HttpExtraRequest.HEADER.toLowerCase();

  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase() !== extraHeader),
  );
};

export class CountRestDataProvider<
  TResource extends string = string,
> extends DefaultRestDataProvider<TResource> {
  override getListHelper<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, AnyType>;
    filter: Record<string, AnyType>;
    requestProps: { headers?: HeadersInit; body?: AnyType; method: TRequestMethod };
  }) {
    const { resource, queryKey, filter, requestProps } = opts;

    // The base class reads the rows and keeps the route's list extras as `meta.extra`.
    const list = super.getListHelper<RecordType>(opts);

    const count = this.networkService.doRequest({
      requestCountData: RequestCountData.DATA_ONLY,
      type: RequestTypes.SEND,
      paths: [resource, 'count'],
      query: { ...queryKey, where: filter?.where },
      ...requestProps,
      headers: withoutExtraHeader(requestProps.headers),
    });

    return Promise.all([list, count]).then(([listResult, countResult]) => {
      return {
        data: listResult.data,
        total: (countResult?.data as AnyType)?.count ?? 0,
        ...('meta' in listResult && listResult.meta ? { meta: listResult.meta } : {}),
      };
    });
  }
}
