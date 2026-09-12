import { type RaRecord } from 'ra-core';

import {
  type AnyType,
  RequestCountData,
  RequestTypes,
  type TRequestMethod,
  type TRequestType,
} from '@venizia/ardor-kernel';
import { DefaultRestDataProvider } from './rest-data';

export class CountRestDataProvider<
  TResource extends string = string,
> extends DefaultRestDataProvider<TResource> {
  //---------------------------------------------------------------------------
  override getListHelper<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, AnyType>;
    filter: Record<string, AnyType>;
    requestProps: { headers?: HeadersInit; body?: AnyType; method: TRequestMethod };
  }) {
    const { type, resource, queryKey, filter, requestProps } = opts;

    const paths = [resource];

    const response = this.networkService.doRequest<RecordType[]>({
      requestCountData: RequestCountData.DATA_ONLY,
      type,
      paths,
      query: { ...queryKey, filter },
      ...requestProps,
    });

    const responseCount = this.networkService.doRequest({
      requestCountData: RequestCountData.DATA_ONLY,
      type: RequestTypes.SEND,
      paths: [resource, 'count'],
      query: { ...queryKey, where: filter?.where },
      ...requestProps,
    });

    const responseAll = Promise.all([response, responseCount]).then((responses: AnyType[]) => {
      return {
        data: responses?.[0]?.data,
        total: responses?.[1]?.data?.count ?? 0,
      };
    });

    return responseAll;
  }
}
