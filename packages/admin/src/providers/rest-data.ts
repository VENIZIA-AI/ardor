import { type Container, getError, inject } from '@venizia/ignis-inversion';
import omit from 'lodash/omit.js';
import type {
  CreateParams,
  CreateResult,
  DeleteManyParams,
  DeleteManyResult,
  DeleteParams,
  DeleteResult,
  GetListParams,
  GetListResult,
  GetManyParams,
  GetManyReferenceParams,
  GetManyReferenceResult,
  GetManyResult,
  GetOneParams,
  GetOneResult,
  Identifier,
  QueryFunctionContext,
  RaRecord,
  UpdateManyParams,
  UpdateManyResult,
  UpdateParams,
  UpdateResult,
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
  NetworkHeaders,
  type ISendParams,
  type ISendResponse,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  type TRequestMethod,
  type TRequestType,
} from '@venizia/ardor-kernel';
import type { IDataProvider } from '@/common';
import { ListFilterBuilder } from './list-filter';

export class DefaultRestDataProvider<TResource extends string = string> extends BaseProvider<
  IDataProvider<TResource>
> {
  private cachedNetworkService?: DefaultNetworkRequestService;

  constructor(
    @inject({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
    protected restDataProviderOptions: IRestDataProviderOptions,
    @inject({ key: CoreBindings.APPLICATION_INFO })
    protected applicationInfo: IApplicationInfo,
  ) {
    super({ scope: DefaultRestDataProvider.name });
  }

  /**
   * Builds the network service this provider sends through. Override it to return a subclass of
   * `DefaultNetworkRequestService` that overrides its hooks (`refreshToken`, `resolveAuthToken`, ...).
   * Called once, on first use, so a subclass's own fields are set by then.
   */
  protected createNetworkService(): DefaultNetworkRequestService {
    return new DefaultNetworkRequestService({
      name: 'default-application-network-service',
      baseUrl: this.restDataProviderOptions.url,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      noAuthPathRegex: this.restDataProviderOptions.noAuthPathRegex,
      headers: this.restDataProviderOptions.headers,
      authRecovery: this.restDataProviderOptions.authRecovery,
    });
  }

  protected get networkService(): DefaultNetworkRequestService {
    this.cachedNetworkService ??= this.createNetworkService();
    return this.cachedNetworkService;
  }

  getNetworkService() {
    return this.networkService;
  }

  /**
   * The ids a bulk write touched, read from the affected rows the server answers (not the ids asked
   * for). A body that is not a row array leaves `data` out.
   */
  protected toAffectedIds(opts: { rows: unknown }): Array<Identifier> | undefined {
    const { rows } = opts;

    if (!Array.isArray(rows)) {
      return undefined;
    }

    return rows.map((row: { id: Identifier }) => row.id);
  }

  /**
   * See `ListFilterBuilder.build`. Override it to change the filter a list request sends; shared by
   * `getList` and `getManyReference`.
   */
  protected buildListFilter(opts: { params: GetListParams & ICustomParams }) {
    return ListFilterBuilder.build(opts);
  }

  /** `HttpDataSource` settings that send what this provider sends, channel and tracing id included. */
  getDataSourceAuth() {
    return this.networkService.getDataSourceAuth({
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });
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

    // The list extras a route answered reach react-admin as the result's `meta.extra`.
    return response.then(({ extra, ...rest }) => {
      return extra ? { ...rest, meta: { extra } } : rest;
    });
  }

  async getList<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: GetListParams & QueryFunctionContext & ICustomParams;
  }): Promise<GetListResult<RecordType>> {
    const { resource, params } = opts;
    const { filter, queryKey, extra } = this.buildListFilter({ params });

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
      extra,
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

  async getOne<RecordType extends RaRecord = AnyType>(opts: {
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
    const queryKey = ListFilterBuilder.extractQueryParams({ params: filter?.params });

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

  async getMany<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: GetManyParams<RecordType> & QueryFunctionContext & ICustomParams;
  }): Promise<GetManyResult<RecordType>> {
    const { resource, params } = opts;

    const filter = params?.meta?.filter ?? {};
    const queryKey = ListFilterBuilder.extractQueryParams({ params: filter?.params });

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    // Always the GET, under the controller's own `find()`, so its scoping applies. A very long id
    // list answers 414/431.
    return this.networkService.doRequest<RecordType[]>({
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
  }

  async getManyReference<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: GetManyReferenceParams & QueryFunctionContext & ICustomParams;
  }): Promise<GetManyReferenceResult<RecordType>> {
    const { resource, params } = opts;

    const { target, id, ...listParams } = params;
    const { filter, queryKey, extra } = this.buildListFilter({ params: listParams });

    filter.where[target] = id;

    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
      extra,
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

  async update<RecordType extends RaRecord = AnyType>(opts: {
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

  async updateMany<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: UpdateManyParams;
  }): Promise<UpdateManyResult<RecordType>> {
    const { resource, params } = opts;
    const { ids, data } = params;

    if (!ids.length) {
      throw getError({ message: '[updateMany] No IDs to execute update!' });
    }

    // The body's `where` is the row selector, so a `where` field in the data is refused.
    if (isDefined(data) && Object.prototype.hasOwnProperty.call(data, 'where')) {
      throw getError({
        message:
          '[updateMany] data carries a "where" field, which the bulk route reads as the row selector and never writes. Update those records with update() instead.',
      });
    }

    // The selector goes in the body: an id list in the URL hits 431 at ~400 UUIDs.
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
      .then(result => {
        return { data: this.toAffectedIds({ rows: result.data }) };
      });
  }

  async create<
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

  async delete<RecordType extends RaRecord = AnyType>(opts: {
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

  async deleteMany<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: DeleteManyParams<RecordType>;
  }): Promise<DeleteManyResult<RecordType>> {
    const { resource, params } = opts;

    const { ids } = params;

    if (!ids.length) {
      throw getError({ message: '[deleteMany] No IDs to execute delete!' });
    }

    // One atomic request with the selector in the body, as in `updateMany`.
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
      .then(result => {
        return { data: this.toAffectedIds({ rows: result.data }) };
      });
  }

  async send<TResult = AnyType>(opts: {
    resource: TResource;
    params: ISendParams;
  }): Promise<ISendResponse<TResult>> {
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
      request.headers = NetworkHeaders.merge({ sources: [request.headers, headers] });
    }

    const response = this.networkService.doRequest<TResult>({
      requestCountData,
      type: requestType ?? RequestTypes.SEND,
      method,
      query,
      paths: [resource],
      ...request,
    });

    return response;
  }

  /**
   * react-admin's data provider contract takes positional arguments, `(resource, params)`: the one
   * place this class does not take an `opts` object. Each method hands them to the `opts` method.
   */
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
      getDataSourceAuth: () => {
        return this.getDataSourceAuth();
      },
    };
  }
}
