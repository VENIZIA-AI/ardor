import type { Store } from '@reduxjs/toolkit';
import type { Container } from '@venizia/ignis-inversion';
import type { TExtraRequest } from '@venizia/ignis-kernel/repository';
import type { AuthProvider, CoreAdminProps, DataProvider, Locale, ResourceProps } from 'ra-core';
import type { ReactNode } from 'react';
import type { RouteProps } from 'react-router-dom';

import type {
  DefaultNetworkRequestService,
  IDataSourceAuth,
  ISendParams,
  ISendResponse,
  RequestCountData,
  TConstValue,
  TRequestMethod,
  TRequestType,
} from '@venizia/ardor-kernel';
import type { TFeature } from '@/features/feature';

/** What `DefaultRestDataProvider.request` sends: every react-admin method goes through it. */
export interface IRestRequestOptions<TResource extends string = string> {
  resource: TResource;
  type: TRequestType;
  method: TRequestMethod;
  /** Default `[resource]`. */
  paths?: Array<string>;
  body?: unknown;
  bodyType?: ISendParams['bodyType'];
  query?: Record<string, unknown>;
  extra?: TExtraRequest;
  /** Win over the computed headers: a caller that names a header means it. */
  headers?: HeadersInit;
  requestCountData?: TConstValue<typeof RequestCountData>;
}

/** The nine data methods of react-admin, as ra-core declares them. */
export type IReactAdminDataProvider<TResource extends string = string> = Pick<
  DataProvider<TResource>,
  | 'getList'
  | 'getOne'
  | 'getMany'
  | 'getManyReference'
  | 'update'
  | 'updateMany'
  | 'create'
  | 'delete'
  | 'deleteMany'
>;

export interface IDataProvider<
  TResource extends string = string,
> extends IReactAdminDataProvider<TResource> {
  send: <TResult = unknown>(opts: {
    resource: TResource;
    params: ISendParams;
  }) => Promise<ISendResponse<TResult>>;

  getNetworkService(): DefaultNetworkRequestService;

  /** Spread into an `HttpDataSource`: the repository then sends what this provider sends. */
  getDataSourceAuth(): IDataSourceAuth;
}

/** The auth methods of react-admin, as ra-core declares them; `getPermissions` is required here. */
export type IReactAdminAuthProvider = Required<
  Pick<AuthProvider, 'login' | 'logout' | 'checkAuth' | 'checkError' | 'getPermissions'>
> &
  Pick<AuthProvider, 'getIdentity' | 'canAccess'>;

export interface IAuthProvider extends IReactAdminAuthProvider {
  getRoles: (params?: unknown) => Promise<Set<string>>;
  /** `true` when the session was refreshed, `false` when there is no refresh to make. */
  refreshToken: () => Promise<boolean>;
}

export interface II18nProviderOptions {
  /** Messages by locale, merged over the English ones: a source may hold only the keys it relabels. */
  i18nSources?: Record<string, object>;
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
  /**
   * The features to mount, when the shell mounts fewer than the application bound - filter
   * `Features.read({ container })` and pass the result. Absent, every bound feature is mounted. The
   * list is read as given: pass the same array until the filter changes, and remount the application
   * (a `key`) when it does.
   */
  features?: Array<TFeature>;
}
