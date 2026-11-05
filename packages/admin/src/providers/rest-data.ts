import { type Container, getError, inject } from '@venizia/ignis-inversion';
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
  BaseProvider,
  CoreBindings,
  type DefaultAuthService,
  DefaultNetworkRequestService,
  type IApplicationInfo,
  type INetworkResponse,
  type ICustomParams,
  type IRestDataProviderOptions,
  ValueUtility,
  NetworkHeaders,
  type ISendParams,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  type TRequestType,
} from '@venizia/ardor-kernel';
import type { TExtraRequest } from '@venizia/ignis-kernel/repository';

import type { IDataProvider, IRestRequestOptions } from '@/common';
import { type IListFilter, ListFilterBuilder } from './list-filter';

/**
 * The react-admin data provider over an IGNIS REST API. Each method takes one `opts` object
 * (`{ resource, params }`) and resolves the result react-admin expects; it rejects with the error
 * the network service throws (a non-2xx response, an empty base URL, an auth failure that cannot be
 * recovered). A subclass overrides the protected hooks (`createNetworkService`, `buildListFilter`,
 * `requestList`).
 *
 * @example
 * ```ts
 * import { type BaseArdorApplication, configuration, CoreBindings, DefaultRestDataProvider, inject, provide } from '@venizia/ardor';
 *
 * @configuration()
 * export class DataConfiguration {
 *   constructor(@inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly application: BaseArdorApplication) {}
 *
 *   @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
 *   options() {
 *     return { url: '/api', noAuthPaths: ['/auth/sign-in'] };
 *   }
 *
 *   @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
 *   dataProvider() {
 *     return this.application.instantiate(DefaultRestDataProvider).value(this.application);
 *   }
 * }
 * ```
 */
export class DefaultRestDataProvider<TResource extends string = string> extends BaseProvider<
  IDataProvider<TResource>
> {
  private cachedNetworkService?: DefaultNetworkRequestService;
  private authService?: DefaultAuthService;

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
      authService: this.authService,
    });
  }

  protected get networkService(): DefaultNetworkRequestService {
    this.cachedNetworkService ??= this.createNetworkService();

    return this.cachedNetworkService;
  }

  /** The network service every request of this provider goes through; built on first use. */
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

  /**
   * The one request every method makes: the headers and body from `getRequestProps`, then
   * `doRequest`. `paths` default to `[resource]`; headers in `headers` win over the computed
   * ones, because a caller that names a header means it.
   */
  protected request<TResult = unknown>(
    opts: IRestRequestOptions<TResource>,
  ): Promise<INetworkResponse<TResult>> {
    const {
      resource,
      type,
      method,
      paths = [resource],
      body,
      bodyType,
      query,
      extra,
      headers,
      requestCountData = RequestCountData.DATA_ONLY,
    } = opts;

    const props = this.networkService.getRequestProps({
      requestCountData,
      resource,
      body,
      bodyType,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
      extra,
    });

    return this.networkService.doRequest<TResult>({
      requestCountData,
      type,
      method,
      paths,
      query,
      ...props,
      headers: headers
        ? NetworkHeaders.merge({ sources: [props.headers, headers] })
        : props.headers,
    });
  }

  /**
   * The list GET: the filter in the query, and the extras a route answered as the result's
   * `meta.extra`. Override it to change how a list is read (`CountRestDataProvider` adds the total).
   */
  protected requestList<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, unknown>;
    filter: IListFilter;
    extra?: TExtraRequest;
  }) {
    const { resource, type, queryKey, filter, extra } = opts;

    return this.request<RecordType[]>({
      resource,
      type,
      method: RequestMethods.GET,
      query: { ...queryKey, filter },
      extra,
    }).then(({ extra: answered, ...rest }) => {
      return answered ? { ...rest, meta: { extra: answered } } : rest;
    });
  }

  /**
   * `GET /{resource}` with the filter built from the list params in the query. Resolves the rows and
   * `total` (the `Content-Range` total, else the page's row count), plus `meta.extra` when a route
   * answered extras.
   */
  async getList<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    params: GetListParams & QueryFunctionContext & ICustomParams;
  }): Promise<GetListResult<RecordType>> {
    const { resource, params } = opts;
    const { filter, queryKey, extra } = this.buildListFilter({ params });

    return this.requestList<RecordType>({
      type: RequestTypes.GET_LIST,
      resource,
      queryKey,
      filter,
      extra,
    });
  }

  /**
   * `GET /{resource}/{id}`, with `params.meta.filter` as the query filter. Resolves `{ data }`.
   */
  async getOne<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    params: GetOneParams<RecordType> & QueryFunctionContext & ICustomParams;
  }): Promise<GetOneResult<RecordType>> {
    const { resource, params } = opts;

    const { params: filterParams, ...filter } = params?.meta?.filter ?? {};
    const queryKey = ListFilterBuilder.extractQueryParams({ params: filterParams });

    return this.request<RecordType>({
      resource,
      type: RequestTypes.GET_ONE,
      method: RequestMethods.GET,
      paths: [resource, `${params.id}`],
      query: { ...queryKey, filter },
    });
  }

  /**
   * `GET /{resource}` with the ids in `filter.where.id.inq`, merged into `params.meta.filter`.
   * Resolves `{ data }`.
   */
  async getMany<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    params: GetManyParams<RecordType> & QueryFunctionContext & ICustomParams;
  }): Promise<GetManyResult<RecordType>> {
    const { resource, params } = opts;

    const { params: filterParams, ...filter } = params?.meta?.filter ?? {};
    const queryKey = ListFilterBuilder.extractQueryParams({ params: filterParams });

    // Always the GET, under the controller's own `find()`, so its scoping applies. A very long id
    // list answers 414/431.
    return this.request<RecordType[]>({
      resource,
      type: RequestTypes.GET_MANY,
      method: RequestMethods.GET,
      query: {
        ...queryKey,
        filter: {
          ...filter,
          where: { ...filter?.where, id: { inq: params.ids } },
        },
      },
    });
  }

  /**
   * As `getList`, with `filter.where[target] = id`. Resolves the rows and `total`.
   */
  async getManyReference<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    params: GetManyReferenceParams & QueryFunctionContext & ICustomParams;
  }): Promise<GetManyReferenceResult<RecordType>> {
    const { resource, params } = opts;

    const { target, id, ...listParams } = params;
    const { filter, queryKey, extra } = this.buildListFilter({ params: listParams });

    filter.where[target] = id;

    return this.requestList<RecordType>({
      type: RequestTypes.GET_MANY_REFERENCE,
      resource,
      queryKey,
      filter,
      extra,
    });
  }

  /** `PATCH /{resource}/{id}` with `params.data` as the body. Resolves `{ data }`. */
  async update<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    params: UpdateParams;
  }): Promise<UpdateResult<RecordType>> {
    const { resource, params } = opts;

    return this.request<RecordType>({
      resource,
      type: RequestTypes.UPDATE,
      method: RequestMethods.PATCH,
      paths: [resource, `${params.id}`],
      body: params.data,
    });
  }

  /**
   * `PATCH /{resource}` with `{ ...params.data, where: { id: { inq: ids } } }` as the body. Resolves
   * `{ data }`, the ids of the rows the server answered (`undefined` when the answer is not a row
   * array). Rejects when `ids` is empty or `params.data` has a `where` field, before any request.
   */
  async updateMany<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    params: UpdateManyParams;
  }): Promise<UpdateManyResult<RecordType>> {
    const { resource, params } = opts;
    const { ids, data } = params;

    if (!ids.length) {
      throw getError({ message: '[updateMany] No IDs to execute update!' });
    }

    // The body's `where` is the row selector, so a `where` field in the data is refused.
    if (ValueUtility.isDefined(data) && Object.prototype.hasOwnProperty.call(data, 'where')) {
      throw getError({
        message:
          '[updateMany] data carries a "where" field, which the bulk route reads as the row selector and never writes. Update those records with update() instead.',
      });
    }

    // The selector goes in the body: an id list in the URL hits 431 at ~400 UUIDs.
    return this.request<Array<RecordType>>({
      resource,
      type: RequestTypes.UPDATE_MANY,
      method: RequestMethods.PATCH,
      body: { ...data, where: { id: { inq: ids } } },
    }).then((result) => {
      return { data: this.toAffectedIds({ rows: result.data }) };
    });
  }

  /** `POST /{resource}` with `params.data` as the body. Resolves `{ data }`, the created record. */
  async create<
    RecordType extends Omit<RaRecord, 'id'> = Omit<RaRecord, 'id'>,
    ResultRecordType extends RaRecord = RecordType & { id: Identifier },
  >(opts: { resource: TResource; params: CreateParams }): Promise<CreateResult<ResultRecordType>> {
    const { resource, params } = opts;

    return this.request<ResultRecordType>({
      resource,
      type: RequestTypes.CREATE,
      method: RequestMethods.POST,
      body: params.data,
    });
  }

  /** `DELETE /{resource}/{id}`. Resolves `{ data }`, the record the server answered. */
  async delete<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    params: DeleteParams<RecordType>;
  }): Promise<DeleteResult<RecordType>> {
    const { resource, params } = opts;

    return this.request<RecordType>({
      resource,
      type: RequestTypes.DELETE,
      method: RequestMethods.DELETE,
      paths: [resource, `${params.id}`],
    });
  }

  /**
   * `DELETE /{resource}` with `{ where: { id: { inq: ids } } }` as the body. Resolves `{ data }`, the
   * ids of the rows the server answered (`undefined` when the answer is not a row array). Rejects
   * when `ids` is empty, before any request.
   */
  async deleteMany<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    params: DeleteManyParams<RecordType>;
  }): Promise<DeleteManyResult<RecordType>> {
    const { resource, params } = opts;

    const { ids } = params;

    if (!ids.length) {
      throw getError({ message: '[deleteMany] No IDs to execute delete!' });
    }

    // One atomic request with the selector in the body, as in `updateMany`.
    return this.request<Array<RecordType>>({
      resource,
      type: RequestTypes.DELETE_MANY,
      method: RequestMethods.DELETE,
      body: { where: { id: { inq: ids } } },
    }).then((result) => {
      return { data: this.toAffectedIds({ rows: result.data }) };
    });
  }

  /**
   * Sends `params.method` to `/{resource}` with the provider's headers and auth; `requestType`
   * defaults to `RequestTypes.SEND`. Resolves the response read by that type. Rejects when
   * `params.method` is missing, before any request.
   */
  async send<TResult = unknown>(opts: {
    resource: TResource;
    params: ISendParams;
  }): Promise<INetworkResponse<TResult>> {
    const { resource, params } = opts;

    if (!params?.method) {
      throw getError({
        message: '[send] Invalid http method to send request!',
      });
    }

    const { method, query, requestCountData, requestType, headers, body, bodyType, extra } = params;

    return this.request<TResult>({
      resource,
      type: requestType ?? RequestTypes.SEND,
      method,
      body,
      bodyType,
      query,
      extra,
      headers: headers as HeadersInit | undefined,
      requestCountData,
    });
  }

  /**
   * react-admin's data provider contract takes positional arguments, `(resource, params)`: the one
   * place this class does not take an `opts` object. Each method hands them to the `opts` method.
   */
  override value(container: Container): IDataProvider<TResource> {
    // Read here, not injected: a subclass with its own constructor rarely forwards a further argument.
    this.authService = container.get<DefaultAuthService>({
      key: CoreBindings.DEFAULT_AUTH_SERVICE,
      isOptional: true,
    });

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
