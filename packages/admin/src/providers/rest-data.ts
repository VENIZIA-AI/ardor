import { Container, getError, inject } from '@venizia/ignis-inversion';
import omit from 'lodash/omit';
import {
  type CreateParams,
  type CreateResult,
  type DeleteManyParams,
  type DeleteManyResult,
  type DeleteParams,
  type DeleteResult,
  type GetListParams,
  type GetListResult,
  type GetManyParams,
  type GetManyReferenceParams,
  type GetManyReferenceResult,
  type GetManyResult,
  type GetOneParams,
  type GetOneResult,
  type Identifier,
  type QueryFunctionContext,
  type RaRecord,
  type UpdateManyParams,
  type UpdateManyResult,
  type UpdateParams,
  type UpdateResult,
} from 'ra-core';

import {
  type AnyType,
  BaseProvider,
  CoreBindings,
  DefaultNetworkRequestService,
  type IApplicationInfo,
  type ICustomParams,
  type IRestDataProviderOptions,
  isDefined,
  type ISendParams,
  type ISendResponse,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  type TRequestMethod,
  type TRequestType,
} from '@venizia/ardor-kernel';
import { type IDataProvider } from '@/common';

/** `HeadersInit` admits a `Headers` instance and a tuple list; the network layer only ever builds a record. */
const toHeaderRecord = (headers: HeadersInit | undefined): Record<string, string> => {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  return Array.isArray(headers) ? Object.fromEntries(headers) : headers;
};

/**
 * The ids a bulk write actually touched, which is what react-admin's `updateMany` and `deleteMany`
 * results carry.
 *
 * Read from the rows the server reports - an IGNIS bulk route answers the affected rows as an array
 * when asked for `x-request-count: 0` - not from the ids that were asked for: an id that no longer
 * exists is asked for and never touched. A body that is not a row array leaves `data` out, which
 * react-admin allows, rather than claiming every requested id was written.
 */
const toAffectedIds = (opts: { rows: unknown }): Array<Identifier> | undefined => {
  const { rows } = opts;

  if (!Array.isArray(rows)) {
    return undefined;
  }

  return rows.map((row: { id: Identifier }) => row.id);
};

export class DefaultRestDataProvider<TResource extends string = string> extends BaseProvider<
  IDataProvider<TResource>
> {
  protected networkService: DefaultNetworkRequestService;

  constructor(
    @inject({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
    protected restDataProviderOptions: IRestDataProviderOptions,
    @inject({ key: CoreBindings.APPLICATION_INFO })
    protected applicationInfo: IApplicationInfo,
  ) {
    super({ scope: DefaultRestDataProvider.name });

    this.networkService = new DefaultNetworkRequestService({
      name: 'default-application-network-service',
      baseUrl: this.restDataProviderOptions.url,
      useAuth: this.restDataProviderOptions.useAuth,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      noAuthPathRegex: this.restDataProviderOptions.noAuthPathRegex,
      headers: this.restDataProviderOptions.headers,
      authRecovery: this.restDataProviderOptions.authRecovery,
    });
  }

  getNetworkService() {
    return this.networkService;
  }

  getListHelper<RecordType extends RaRecord = AnyType>(opts: {
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

    return response;
  }

  getList<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: GetListParams & QueryFunctionContext & ICustomParams;
  }): Promise<GetListResult<RecordType>> {
    const { resource, params } = opts;
    const { pagination, sort, filter: filterGetList, meta, ...rest } = params;

    let filter: Record<string, AnyType> = {};

    if (filterGetList?.where) {
      filter = { ...filterGetList, where: filterGetList.where };
    } else {
      filter['where'] = {
        ...omit(filterGetList, ['include', 'params', 'noLimit', 'fields']),
      };
      filter['include'] = filterGetList?.include;
      filter['fields'] = filterGetList?.fields;
      filter['params'] = filterGetList?.params;
      filter['noLimit'] = filterGetList?.noLimit;
    }

    if (sort?.field) {
      filter['order'] = [`${sort.field} ${sort.order}`];
    }

    // Remove default limit and skip in react-admin
    if (filter?.noLimit) {
      filter['limit'] = undefined;
      filter['skip'] = undefined;
      filter['offset'] = undefined;
      filter['noLimit'] = undefined;
    } else {
      const { page = 0, perPage = 0 } = pagination ?? {};

      if (perPage >= 0) {
        filter['limit'] = perPage;
      }

      if (perPage > 0 && page >= 0) {
        filter['skip'] = (page - 1) * perPage;
        filter['offset'] = (page - 1) * perPage;
      }
    }

    for (const key in rest) {
      // Read `rest`, the object being iterated, rather than `params` it was split from - they hold
      // the same value here, and naming two sources for one read invites them to drift apart.
      //
      // Skip only undefined and null. A filter of `false` or `0` is a filter, and dropping it sends
      // a narrower query than the caller wrote, with nothing to show they differ.
      if (!isDefined(rest[key])) {
        continue;
      }

      filter[key] = rest[key];
    }

    const queryKey: Record<string, AnyType> = {};

    if (filter?.params) {
      for (const key in filter.params) {
        queryKey[key] = filter.params[key];
      }
      filter['params'] = undefined;
    }

    if (meta) {
      for (const key in meta) {
        queryKey[key] = meta[key];
      }
    }

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    const requestProps = {
      method: RequestMethods.GET as TRequestMethod,
      ...request,
    };

    const response = this.getListHelper<RecordType>({
      type: RequestTypes.GET_LIST,
      resource,
      queryKey,
      filter,
      requestProps,
    });

    return response;
  }

  getOne<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: GetOneParams<RecordType> & QueryFunctionContext & ICustomParams;
  }): Promise<GetOneResult<RecordType>> {
    const { resource, params } = opts;

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });
    const filter = params?.meta?.filter ?? {};
    const queryKey: Record<string, AnyType> = {};

    if (filter?.params) {
      for (const key in filter.params) {
        queryKey[key] = filter.params[key];
      }
    }

    const response = this.networkService.doRequest<RecordType>({
      requestCountData: RequestCountData.DATA_ONLY,
      type: RequestTypes.GET_ONE,
      method: RequestMethods.GET,
      query: { ...queryKey, filter: { ...omit(filter, 'params') } },
      paths: [resource, `${params.id}`],
      ...request,
    });

    return response;
  }

  getMany<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: GetManyParams<RecordType> & QueryFunctionContext & ICustomParams;
  }): Promise<GetManyResult<RecordType>> {
    const { resource, params } = opts;

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });
    const filter = params?.meta?.filter ?? {};
    const queryKey: Record<string, AnyType> = {};

    if (filter?.params) {
      for (const key in filter.params) {
        queryKey[key] = filter.params[key];
      }
    }

    const response = this.networkService.doRequest<RecordType[]>({
      requestCountData: RequestCountData.DATA_ONLY,
      type: RequestTypes.GET_MANY,
      method: RequestMethods.GET,
      query: {
        ...queryKey,
        filter: {
          ...omit(filter, 'params'),
          where: { ...filter?.where, id: { inq: params.ids } },
        },
      },
      paths: [resource],
      ...request,
    });

    return response;
  }

  getManyReference<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: GetManyReferenceParams & QueryFunctionContext & ICustomParams;
  }): Promise<GetManyReferenceResult<RecordType>> {
    const { resource, params } = opts;

    const { pagination, sort, filter: filterGetMany, meta, target, id, ...rest } = params;

    let filter: Record<string, AnyType> = {};

    if (filterGetMany?.where) {
      filter = { ...filterGetMany, where: { ...filterGetMany.where } };
    } else {
      filter['where'] = {
        ...omit(filterGetMany, ['include', 'params', 'noLimit', 'fields']),
      };
      filter['include'] = filterGetMany?.include;
      filter['fields'] = filterGetMany?.fields;
      filter['params'] = filterGetMany?.params;
      filter['noLimit'] = filterGetMany?.noLimit;
    }

    filter.where[target] = id;

    if (sort?.field) {
      filter['order'] = [`${sort.field} ${sort.order}`];
    }

    // Remove default limit and skip in react-admin
    if (filter?.noLimit) {
      filter['limit'] = undefined;
      filter['skip'] = undefined;
      filter['offset'] = undefined;
      filter['noLimit'] = undefined;
    } else {
      const { page = 0, perPage = 0 } = pagination;

      if (perPage >= 0) {
        filter['limit'] = perPage;
      }

      if (perPage > 0 && page >= 0) {
        filter['skip'] = (page - 1) * perPage;
        filter['offset'] = (page - 1) * perPage;
      }
    }

    for (const key in rest) {
      // Read `rest`, the object being iterated, rather than `params` it was split from - they hold
      // the same value here, and naming two sources for one read invites them to drift apart.
      //
      // Skip only undefined and null. A filter of `false` or `0` is a filter, and dropping it sends
      // a narrower query than the caller wrote, with nothing to show they differ.
      if (!isDefined(rest[key])) {
        continue;
      }

      filter[key] = rest[key];
    }

    const queryKey: Record<string, AnyType> = {};

    if (filter?.params) {
      for (const key in filter.params) {
        queryKey[key] = filter.params[key];
      }
      filter['params'] = undefined;
    }

    if (meta) {
      for (const key in meta) {
        queryKey[key] = meta[key];
      }
    }

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    const requestProps = {
      method: RequestMethods.GET as TRequestMethod,
      ...request,
    };

    const response = this.getListHelper<RecordType>({
      type: RequestTypes.GET_MANY_REFERENCE,
      resource,
      queryKey,
      filter,
      requestProps,
    });

    return response;
  }

  update<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: UpdateParams;
  }): Promise<UpdateResult<RecordType>> {
    const { resource, params } = opts;

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      body: params.data,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    const response = this.networkService.doRequest<RecordType>({
      requestCountData: RequestCountData.DATA_ONLY,
      type: RequestTypes.UPDATE,
      method: RequestMethods.PATCH,
      paths: [resource, `${params.id}`],
      ...request,
    });

    return response;
  }

  updateMany<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: UpdateManyParams;
  }): Promise<UpdateManyResult<RecordType>> {
    const { resource, params } = opts;
    const { ids, data } = params;

    if (!ids.length) {
      throw getError({ message: '[updateMany] No IDs to execute update!' });
    }

    // The body's `where` is the bulk route's row selector and is never written as data, so a record
    // with a real `where` field cannot say "set where" here - refused rather than silently dropped.
    if (isDefined(data) && Object.prototype.hasOwnProperty.call(data, 'where')) {
      throw getError({
        message:
          '[updateMany] data carries a "where" field, which the bulk route reads as the row selector and never writes. Update those records with update() instead.',
      });
    }

    // The selector travels in the body, not the query. An id list in the URL is capped by the
    // request line: IGNIS measured 431 at 400 UUIDs on Bun, and a proxy with 8k header buffers cuts
    // near 170. The route reads `where` from the query or the body - never both - and answers 400,
    // writing nothing, where a route does not accept it in the body.
    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      body: { ...data, where: { id: { inq: ids } } },
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    return this.networkService
      .doRequest<Array<RecordType>>({
        requestCountData: RequestCountData.DATA_ONLY,
        type: RequestTypes.UPDATE_MANY,
        method: RequestMethods.PATCH,
        paths: [resource],
        ...request,
      })
      .then((rs) => {
        return { data: toAffectedIds({ rows: rs.data }) };
      });
  }

  create<
    RecordType extends Omit<RaRecord, 'id'> = AnyType,
    ResultRecordType extends RaRecord = RecordType & { id: Identifier },
  >(opts: { resource: TResource; params: CreateParams }): Promise<CreateResult<ResultRecordType>> {
    const { resource, params } = opts;

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      body: params.data,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    const response = this.networkService.doRequest<ResultRecordType>({
      requestCountData: RequestCountData.DATA_ONLY,
      type: RequestTypes.CREATE,
      method: RequestMethods.POST,
      paths: [resource],
      ...request,
    });

    return response;
  }

  delete<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: DeleteParams<RecordType>;
  }): Promise<DeleteResult<RecordType>> {
    const { resource, params } = opts;

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    const response = this.networkService.doRequest<RecordType>({
      requestCountData: RequestCountData.DATA_ONLY,
      type: RequestTypes.DELETE,
      method: RequestMethods.DELETE,
      paths: [resource, `${params.id}`],
      ...request,
    });

    return response;
  }

  deleteMany<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: DeleteManyParams<RecordType>;
  }): Promise<DeleteManyResult<RecordType>> {
    const { resource, params } = opts;

    const { ids } = params;

    if (!ids.length) {
      throw getError({ message: '[deleteMany] No IDs to execute delete!' });
    }

    // One request carrying the selector in the body, where this used to fire one DELETE per id. The
    // fan-out was not atomic - a failure part-way surfaced as one error after the rest had already
    // been deleted - and 2000 ids meant 2000 requests. A body keeps the id list off the request line,
    // for the same limit `updateMany` documents.
    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      body: { where: { id: { inq: ids } } },
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    return this.networkService
      .doRequest<Array<RecordType>>({
        requestCountData: RequestCountData.DATA_ONLY,
        type: RequestTypes.DELETE_MANY,
        method: RequestMethods.DELETE,
        paths: [resource],
        ...request,
      })
      .then((rs) => {
        return { data: toAffectedIds({ rows: rs.data }) };
      });
  }

  send<ReturnType = AnyType>(opts: {
    resource: TResource;
    params: ISendParams;
  }): Promise<ISendResponse<ReturnType>> {
    const { resource, params } = opts;

    if (!params?.method) {
      throw getError({
        message: '[send] Invalid http method to send request!',
      });
    }

    const { method, query, requestCountData, requestType, headers, ...rest } = params;

    const request = this.networkService.getRequestProps({
      ...rest,
      requestCountData,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    // Per-call headers win over the computed ones: a caller that names a header means it.
    if (headers) {
      request.headers = {
        ...toHeaderRecord(request.headers),
        ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)])),
      };
    }

    const response = this.networkService.doRequest<ReturnType>({
      requestCountData,
      type: requestType ?? RequestTypes.SEND,
      method,
      query,
      paths: [resource],
      ...request,
    });

    return response;
  }

  override value(_container: Container): IDataProvider<TResource> {
    return {
      getList: (resource, params) => {
        return this.getList({ resource, params });
      },
      getOne: (resource, params) => {
        return this.getOne({ resource, params });
      },
      getMany: (resource, params) => {
        return this.getMany({ resource, params });
      },
      getManyReference: (resource, params) => {
        return this.getManyReference({ resource, params });
      },
      create: (resource, params) => {
        return this.create({ resource, params });
      },
      update: (resource, params) => {
        return this.update({ resource, params });
      },
      updateMany: (resource, params) => {
        return this.updateMany({ resource, params });
      },
      delete: (resource, params) => {
        return this.delete({ resource, params });
      },
      deleteMany: (resource, params) => {
        return this.deleteMany({ resource, params });
      },
      send: (opts: { resource: TResource; params: ISendParams }) => {
        return this.send(opts);
      },
      getNetworkService: () => {
        return this.getNetworkService();
      },
    };
  }
}
