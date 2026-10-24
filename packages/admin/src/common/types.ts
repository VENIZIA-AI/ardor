import type { Store } from '@reduxjs/toolkit';
import type { Container } from '@venizia/ignis-inversion';
import type {
  CoreAdminProps,
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
  Locale,
  QueryFunctionContext,
  RaRecord,
  ResourceProps,
  UpdateManyParams,
  UpdateManyResult,
  UpdateParams,
  UpdateResult,
  UserIdentity,
} from 'ra-core';
import type { ReactNode } from 'react';
import type { RouteProps } from 'react-router-dom';

import type {
  AnyType,
  DefaultNetworkRequestService,
  ICustomParams,
  IDataSourceAuth,
  ISendParams,
  ISendResponse,
} from '@venizia/ardor-kernel';

export interface IReactAdminDataProvider<TResource extends string = string> {
  getList: <RecordType extends RaRecord = AnyType>(
    resource: TResource,
    params: GetListParams & QueryFunctionContext & ICustomParams,
  ) => Promise<GetListResult<RecordType>>;

  getOne: <RecordType extends RaRecord = AnyType>(
    resource: TResource,
    params: GetOneParams<RecordType> & QueryFunctionContext & ICustomParams,
  ) => Promise<GetOneResult<RecordType>>;

  getMany: <RecordType extends RaRecord = AnyType>(
    resource: TResource,
    params: GetManyParams<RecordType> & QueryFunctionContext & ICustomParams,
  ) => Promise<GetManyResult<RecordType>>;

  getManyReference: <RecordType extends RaRecord = AnyType>(
    resource: TResource,
    params: GetManyReferenceParams & QueryFunctionContext & ICustomParams,
  ) => Promise<GetManyReferenceResult<RecordType>>;

  update: <RecordType extends RaRecord = AnyType>(
    resource: TResource,
    params: UpdateParams,
  ) => Promise<UpdateResult<RecordType>>;

  updateMany: <RecordType extends RaRecord = AnyType>(
    resource: TResource,
    params: UpdateManyParams,
  ) => Promise<UpdateManyResult<RecordType>>;

  create: <
    RecordType extends Omit<RaRecord, 'id'> = AnyType,
    ResultRecordType extends RaRecord = RecordType & { id: Identifier },
  >(
    resource: TResource,
    params: CreateParams,
  ) => Promise<CreateResult<ResultRecordType>>;

  delete: <RecordType extends RaRecord = AnyType>(
    resource: TResource,
    params: DeleteParams<RecordType>,
  ) => Promise<DeleteResult<RecordType>>;

  deleteMany: <RecordType extends RaRecord = AnyType>(
    resource: TResource,
    params: DeleteManyParams<RecordType>,
  ) => Promise<DeleteManyResult<RecordType>>;
}

export interface IDataProvider<
  TResource extends string = string,
> extends IReactAdminDataProvider<TResource> {
  send: <TResult = AnyType>(opts: {
    resource: TResource;
    params: ISendParams;
  }) => Promise<ISendResponse<TResult>>;

  getNetworkService(): DefaultNetworkRequestService;

  /** Spread into an `HttpDataSource`: the repository then sends what this provider sends. */
  getDataSourceAuth(): IDataSourceAuth;
}

export interface IReactAdminAuthProvider {
  login: (params: AnyType) => Promise<{ redirectTo?: string | boolean } | void | AnyType>;
  logout: (params: AnyType) => Promise<void | false | string>;
  checkAuth: (params: AnyType & QueryFunctionContext) => Promise<void>;
  checkError: (error: AnyType) => Promise<void>;
  getIdentity?: (params?: QueryFunctionContext) => Promise<UserIdentity>;
  getPermissions: (params: AnyType & QueryFunctionContext) => Promise<AnyType>;
  /** Present only when the application binds `CoreBindings.PERMISSION_PROVIDER`. */
  canAccess?: (params: {
    resource: string;
    action: string;
    record?: unknown;
    signal?: AbortSignal;
  }) => Promise<boolean>;
}

export interface IAuthProvider extends IReactAdminAuthProvider {
  getRoles: (params?: AnyType) => Promise<Set<string>>;
  refreshToken: () => Promise<AnyType>;
}

export interface II18nProviderOptions {
  i18nSources?: Record<string | symbol, AnyType>;
  languages?: Array<Locale>;
}

export interface IApplication extends Omit<CoreAdminProps, 'children'> {
  container: Container;

  enableDebug?: boolean;
  reduxStore: Store;
  suspense: ReactNode;

  /** The application's own resources; each feature's are mounted after them. */
  resources?: Array<ResourceProps>;
  /** The application's own routes; each feature's are mounted after them. */
  routes?: Array<RouteProps>;
}
