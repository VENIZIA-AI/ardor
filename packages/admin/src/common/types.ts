import type { Store } from '@reduxjs/toolkit';
import type { ILogger } from '@venizia/ignis-helpers/core';
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
  /** The first path segment, unless `paths` is set. */
  resource: TResource;
  /** What the response is read as, and what the request is logged as. */
  type: TRequestType;
  /** The HTTP method. */
  method: TRequestMethod;
  /** Default `[resource]`. */
  paths?: Array<string>;
  /** The request body; encoded by `bodyType`. */
  body?: unknown;
  bodyType?: ISendParams['bodyType'];
  /** The query string. */
  query?: Record<string, unknown>;
  /** The list extras, sent in a header. */
  extra?: TExtraRequest;
  /** Win over the computed headers: a caller that names a header means it. */
  headers?: HeadersInit;
  /** Default `RequestCountData.DATA_ONLY`. */
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
  /** A request outside react-admin's methods: the same headers and auth, the method and body of `params`. */
  send: <TResult = unknown>(opts: {
    resource: TResource;
    params: ISendParams;
  }) => Promise<ISendResponse<TResult>>;

  /** The network service every request goes through. */
  getNetworkService(): DefaultNetworkRequestService;

  /** Spread into an `HttpDataSource`: the repository then sends what this provider sends. */
  getDataSourceAuth(): IDataSourceAuth;
}

/** The auth methods of react-admin, as ra-core declares them; `getPermissions` is required here. */
export type IReactAdminAuthProvider = Required<
  Pick<AuthProvider, 'login' | 'logout' | 'checkAuth' | 'checkError' | 'getPermissions'>
> &
  Pick<AuthProvider, 'getIdentity' | 'canAccess'>;

/**
 * What `checkAuth` and `checkError` reject with, as ra-core reads it. `redirectTo: false` skips the
 * redirect of `checkAuth`, `message: false` skips the notification, and `logoutUser: false` (`checkError`
 * only) keeps the user logged in.
 */
export interface IAuthRejection {
  redirectTo?: string | false;
  logoutUser?: boolean;
  message?: string | false;
}

export interface IAuthProvider extends IReactAdminAuthProvider {
  /** The roles of the signed-in user. */
  getRoles: (params?: unknown) => Promise<Set<string>>;
  /** `true` when the session was refreshed, `false` when there is no refresh to make. */
  refreshToken: () => Promise<boolean>;
}

/**
 * The messages of one locale: an object, or a loader called the first time the locale is used, so a
 * bundler splits the catalogue out of the boot bundle (`() => import('./vi')`, whose default export
 * is the messages). A loader that fails leaves that locale on the English messages.
 */
export type TI18nSource = object | (() => Promise<object>);

export interface II18nProviderOptions {
  /** Messages by locale: the application's own over the features', English for a locale with no source or whose loader failed. */
  i18nSources?: Record<string, TI18nSource>;
  /** The locales the app offers. Default English only. */
  languages?: Array<Locale>;
}

/** The props of `ArdorApplication`: react-admin's `CoreAdmin` props except `children`, plus the ARDOR ones. */
export interface IApplication extends Omit<CoreAdminProps, 'children'> {
  /** The container the providers and the features are resolved from. */
  container: Container;

  /**
   * The logger `useApplicationLogger()` returns. Absent, a console logger named after the application
   * (IGNIS's, so a provider registered with `LoggerFactory.use` is the one behind it).
   */
  logger?: ILogger;
  /** The store the Redux provider of the shell serves. */
  reduxStore: Store;
  /** Rendered as the `Suspense` fallback and while feature messages for the locale load. */
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
