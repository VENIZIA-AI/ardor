import type { Store } from '@reduxjs/toolkit';
import type { ILogger } from '@venizia/ignis-helpers/core';
import type { Container } from '@venizia/ignis-inversion';
import type { TExtraRequest } from '@venizia/ignis-kernel/repository';
import type {
  AuthProvider,
  CoreAdminProps,
  DataProvider,
  I18nProvider,
  Locale,
  ResourceProps,
} from 'ra-core';
import type { ReactNode } from 'react';

import type {
  DefaultNetworkRequestService,
  IDataSourceAuth,
  INetworkResponse,
  ISendParams,
  IResponseSchema,
  RequestCountData,
  TConstValue,
  TRequestMethod,
  TRequestType,
} from '@venizia/ardor-kernel';
import type { TArdorRoute, TFeature } from '@/features/feature';

/** What `DefaultRestDataProvider.request` sends: every react-admin method goes through it. */
export interface IRestRequestOptions<TResource extends string = string> {
  /** The first path segment, unless `paths` is set. */
  resource: TResource;
  /** What the response is read as, and what the request is logged as. */
  type: TRequestType;
  /** The HTTP method. */
  method: TRequestMethod;
  /**
   * The path segments of the request.
   * @default [resource]
   */
  paths?: Array<string>;
  /** The body of the request. */
  payload?: ISendParams['payload'];
  /** The query string. */
  query?: Record<string, unknown>;
  /** The list extras, sent in a header. */
  extra?: TExtraRequest;
  /** Win over the computed headers: a caller that names a header means it. */
  headers?: HeadersInit;
  /**
   * What the request asks the server to count.
   * @default RequestCountData.DATA_ONLY
   */
  requestCountData?: TConstValue<typeof RequestCountData>;
  /** Aborts the request; it then rejects with the signal's reason. */
  signal?: AbortSignal;
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

/** The two shapes of `IDataProvider.send`. */
export interface ISendRequest<TResource extends string = string> {
  /** With a `schema`, `data` is what it checked and typed; what it refuses throws a `FetchSchemaError` (502). */
  <TResult>(opts: {
    resource: TResource;
    params: ISendParams;
    schema: IResponseSchema<TResult>;
  }): Promise<INetworkResponse<TResult>>;
  /** With no schema, the `data` of the response is `unknown`. */
  (opts: {
    resource: TResource;
    params: ISendParams;
    schema?: IResponseSchema;
  }): Promise<INetworkResponse>;
}

/** react-admin's data provider with a free-form `send` and access to the network service and its auth. */
export interface IDataProvider<
  TResource extends string = string,
> extends IReactAdminDataProvider<TResource> {
  /**
   * `true` makes react-admin pass the `signal` of its queries to the read methods, so a read it no
   * longer needs (a newer filter or page) is aborted. `DefaultRestDataProvider` sets it.
   */
  supportAbortSignal?: boolean;

  /** A request outside react-admin's methods: the same headers and auth, the method and body of `params`. */
  send: ISendRequest<TResource>;

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

/** The auth provider of an ARDOR application: react-admin's methods, the user's roles and a token refresh. */
export interface IAuthProvider extends IReactAdminAuthProvider {
  /**
   * The roles of the signed-in user, as the browser holds them: they only show or hide interface, and
   * the backend must check every permission on every request.
   */
  getRoles: (params?: unknown) => Promise<Set<string>>;
  /** `true` when the session was refreshed, `false` when there is no refresh to make. */
  refreshToken: () => Promise<boolean>;
}

/**
 * Types the `CoreBindings` keys whose values live in this package, so `useProvider({ key })` answers
 * them with no generic and an application needs no augmentation of its own.
 */
declare module '@venizia/ardor-kernel' {
  interface ICoreBindingTypes {
    restDataProvider: IDataProvider;
    authProvider: IAuthProvider;
    i18nProvider: I18nProvider;
    i18nProviderOptions: II18nProviderOptions;
  }
}

/**
 * The messages of one locale: an object, or a loader called the first time the locale is used, so a
 * bundler splits the catalogue out of the boot bundle (`() => import('./vi')`, whose default export
 * is the messages). A loader that fails leaves that locale on the English messages.
 */
export type TI18nSource = object | (() => Promise<object>);

/** What `DefaultI18nProvider` is built from: the message sources and the languages on offer. */
export interface II18nProviderOptions {
  /**
   * Messages by locale, layered from the bottom: ARDOR's `englishMessages`, the features' and the
   * application's messages of the fallback locale, then the features' and the application's own
   * messages of the chosen locale. A key a locale lacks reads in the layer below it.
   * @default { en: englishMessages }
   */
  i18nSources?: Record<string, TI18nSource>;
  /** What `changeLocale` does with the choice. */
  locale?: {
    /**
     * With `use: true` the chosen locale is kept in `localStorage` (`LocalStorageKeys.scoped({ id }).locale`,
     * under `@app/prefs/`, so a sign-out keeps it) and read first when the provider is built. A stored
     * locale that is not in `languages` is ignored. Outside a browser it does nothing.
     * @default { use: true }
     */
    persist?: { use: false } | { use: true };
  };
  /**
   * The locale whose messages are layered under every other locale.
   * @default { locale: 'en' }
   */
  fallback?: { locale: string };
  /**
   * The locales the app offers.
   * @default [{ locale: 'en', name: 'English' }]
   */
  languages?: Array<Locale>;
}

/** The props of `ArdorApplication`: react-admin's `CoreAdmin` props except `children`, plus the ARDOR ones. */
export interface IArdorApplicationProps extends Omit<CoreAdminProps, 'children'> {
  /** The container the providers and the features are resolved from. */
  container: Container;

  /**
   * The logger `useApplicationLogger()` returns. Absent, a console logger named `ArdorApplication`
   * (IGNIS's, so a provider registered with `LoggerFactory.use` is the one behind it).
   */
  logger?: ILogger;
  /** The store the Redux provider of the shell serves. Absent, the shell mounts no Redux provider. */
  reduxStore?: Store;
  /** Rendered while feature messages for the locale load, and inside the layout while a lazy route page loads. */
  suspense: ReactNode;

  /**
   * The page at `/access-denied`, where react-admin sends a user `canAccess` denies a resource and
   * where `DefaultAuthProvider` sends a `403`.
   * @default AccessDeniedPage
   */
  accessDenied?: CoreAdminProps['accessDenied'];

  /** The application's own resources; each feature's are mounted after them. */
  resources?: Array<ResourceProps>;
  /** The application's own routes; each feature's are mounted after them. */
  routes?: Array<TArdorRoute>;
  /**
   * The features to mount, when the shell mounts fewer than the application bound - filter
   * `Features.read({ container })` and pass the result. Absent, every bound feature is mounted. The
   * list is read as given: pass the same array until the filter changes, and remount the application
   * (a `key`) when it does.
   */
  features?: Array<TFeature>;
}
