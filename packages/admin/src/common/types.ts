import { type Store } from '@reduxjs/toolkit';
import { type Container } from '@venizia/ignis-inversion';
import {
  type CoreAdminProps,
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
  type Locale,
  type QueryFunctionContext,
  type RaRecord,
  type ResourceProps,
  type UpdateManyParams,
  type UpdateManyResult,
  type UpdateParams,
  type UpdateResult,
  type UserIdentity,
} from 'ra-core';
import { type ReactNode } from 'react';
import { type RouteProps } from 'react-router-dom';

import {
  type AnyType,
  type DefaultNetworkRequestService,
  type ICustomParams,
  type ISendParams,
  type ISendResponse,
} from '@venizia/ardor-kernel';

// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
export interface IDataProvider<
  TResource extends string = string,
> extends IReactAdminDataProvider<TResource> {
  send: <ReturnType = AnyType>(opts: {
    resource: TResource;
    params: ISendParams;
  }) => Promise<ISendResponse<ReturnType>>;

  getNetworkService(): DefaultNetworkRequestService;
}

// ----------------------------------------------------------------------
export interface IReactAdminAuthProvider {
  login: (params: AnyType) => Promise<{ redirectTo?: string | boolean } | void | AnyType>;
  logout: (params: AnyType) => Promise<void | false | string>;
  checkAuth: (params: AnyType & QueryFunctionContext) => Promise<void>;
  checkError: (error: AnyType) => Promise<void>;
  getIdentity?: (params?: QueryFunctionContext) => Promise<UserIdentity>;
  getPermissions: (params: AnyType & QueryFunctionContext) => Promise<AnyType>;
}

// ----------------------------------------------------------------------
export interface IAuthProvider extends IReactAdminAuthProvider {
  getRoles: (params?: AnyType) => Promise<Set<string>>;
  refreshToken: () => Promise<AnyType>;
}

// ----------------------------------------------------------------------
export interface II18nProviderOptions {
  i18nSources?: Record<string | symbol, AnyType>;
  listLanguages?: Locale[];
}

// ----------------------------------------------------------------------
export interface IApplication extends Omit<CoreAdminProps, 'children'> {
  container: Container;

  enableDebug?: boolean;
  reduxStore: Store;
  suspense: ReactNode;

  resources: Array<ResourceProps>;
  customRoutes?: {
    routes: Array<RouteProps>;
  };
}
