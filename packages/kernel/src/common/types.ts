import type {
  AnyObject,
  AnyType,
  TConstValue,
  TNumberConstValue,
  TPrettify,
  TStringConstValue,
  ValueOf,
  ValueOptional,
  ValueOptionalExcept,
  ValueOrPromise,
} from '@venizia/ignis-helpers/common';
import type { TBuildInfoRecord } from '@venizia/ignis-helpers/core';
import type { TClass } from '@venizia/ignis-inversion';
import type { TExtraRequest } from '@venizia/ignis-kernel/repository';

import type {
  Environments,
  RequestBodyTypes,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  StorageAreas,
} from './constants';

/** A record id: a string or a number. */
export type IdType = string | number;

// The utility types are IGNIS's: one declaration, re-exported by name so ARDOR's surface is unchanged.
export type {
  AnyObject,
  AnyType,
  TConstValue,
  TNumberConstValue,
  TPrettify,
  TStringConstValue,
  ValueOf,
  ValueOptional,
  ValueOptionalExcept,
  ValueOrPromise,
};

/** One of the `RequestMethods` values. */
export type TRequestMethod = TStringConstValue<typeof RequestMethods>;
/** One of the `Environments` values. */
export type TEnvironment = TStringConstValue<typeof Environments>;

/** What `IDataProvider.send` takes. */
export interface ISendParams {
  /** Required: `send` throws without it. */
  method?: TRequestMethod;
  /** How the response is read. `RequestTypes.SEND` when absent. */
  requestType?: TRequestType;
  /** How `body` is encoded; it goes through as JSON when absent. */
  bodyType?: TRequestBodyType;
  body?: unknown;
  /** Sent as the query string of the request. */
  query?: Record<string, unknown>;
  /** Added to the headers of this request. */
  headers?: Record<string, string | number>;
  /**
   * Whether the response carries a count; sent in `x-request-count`.
   * @default RequestCountData.DATA_ONLY
   */
  requestCountData?: TConstValue<typeof RequestCountData>;
  /** The list extras to ask the route for, sent in `x-request-extra`. */
  extra?: TExtraRequest;
}

/** What `IDataProvider.send` answers: the network service's response. */
export type ISendResponse<T = unknown> = INetworkResponse<T>;

/** One of the `RequestBodyTypes` values. */
export type TRequestBodyType = TStringConstValue<typeof RequestBodyTypes>;

/** One of the `StorageAreas` values. */
export type TStorageArea = TStringConstValue<typeof StorageAreas>;

/** How `BrowserStorage` turns a value into text and back. `decode` may throw: `get` then gives the fallback. */
export interface IStorageCodec<TValue> {
  encode: (value: TValue) => string;
  decode: (text: string) => TValue;
}
/** One of the `RequestTypes` values. */
export type TRequestType = TStringConstValue<typeof RequestTypes>;

/** What `DefaultNetworkRequestService.getRequestProps` takes. */
export interface IGetRequestPropsParams {
  /** Decides whether the request goes without a token (`noAuthPaths`, `noAuthPathRegex`). */
  resource: string;
  /**
   * Whether the response carries a count.
   * @default RequestCountData.DATA_ONLY
   */
  requestCountData?: TConstValue<typeof RequestCountData>;
  body?: unknown;
  /** How `body` is encoded. */
  bodyType?: TRequestBodyType;
  /** Gives the request channel. */
  restDataProviderOptions: IRestDataProviderOptions;
  /** Gives the name the tracing id starts with. */
  applicationInfo: IApplicationInfo;
  /** The list extras to ask the route for, sent in `x-request-extra`. */
  extra?: TExtraRequest;
}

/** The headers and the encoded body of a request. */
export interface IGetRequestPropsResult {
  headers?: HeadersInit;
  body?: unknown;
}

/** Keys react-admin does not know ride on its params and become filter keys; `any`, so ra-core's param interfaces stay assignable. */
export interface ICustomParams {
  params?: Record<string, AnyType>;
  [key: string]: AnyType;
}

/** What `login` read from the sign-in response. `roles` are names. */
export interface ISignInSession {
  userId: number | string;
  token: { value: string; type: string };
  roles: Array<string>;
}

/** Data only: where the auth provider talks to. Behaviour is in `DefaultAuthProvider`'s protected hooks. */
export interface IAuthProviderOptions {
  paths?: {
    /**
     * Where `login` posts: the IGNIS auth controller's route.
     * @default '/auth/sign-in'
     */
    signIn?: string;
    /** Where `checkAuth` validates the stored token. Default: not called; the stored token is enough. */
    checkAuth?: string;
    /**
     * Where the admin goes once `login` resolves.
     * @default '/'
     */
    afterLogin?: string;
  };
}

/** How a request recovers from a 401. */
export interface IAuthRecoveryOptions {
  /**
   * A request to this path never starts a refresh: it is the refresh. Listing it in `noAuthPaths`
   * as well keeps the expired token off that request.
   * @example
   * ```ts
   * import { configuration, CoreBindings, provide } from '@venizia/ardor';
   *
   * @configuration()
   * export class ApiConfiguration {
   *   @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
   *   restDataProviderOptions() {
   *     return {
   *       url: 'https://api.example.com',
   *       // The refresh path is also a no-auth path: the expired token stays off that request, so the
   *       // server identifies the session another way, such as a cookie.
   *       noAuthPaths: ['/auth/sign-in', '/auth/refresh'],
   *       authRecovery: { refreshTokenPath: '/auth/refresh' },
   *     };
   *   }
   * }
   * ```
   */
  refreshTokenPath?: string;
}

/** One pattern or a list; a string is compiled with `new RegExp(...)`. */
export type TNoAuthPathRegex = string | RegExp | Array<string | RegExp>;

/**
 * Data only. A request that matches goes without an `Authorization` header; to send none at all (an
 * API with no sign-in) set `noAuthPathRegex: /./`.
 */
export interface INoAuthOptions {
  /**
   * Exact resource paths which will be requested without authorization header.
   */
  noAuthPaths?: Array<string>;

  /**
   * Pattern(s) of resource paths which will be requested without authorization header.
   * Accept `RegExp` or `string` (which will be compiled with `new RegExp(...)`).
   */
  noAuthPathRegex?: TNoAuthPathRegex;
}

/** Data only: where and how the REST data provider sends. */
export interface IRestDataProviderOptions extends INoAuthOptions {
  /** The base URL requests are sent to. */
  url: string;
  /**
   * Sent in `x-request-channel`.
   * @default RequestChannel.WEB
   */
  requestTracingChannel?: string;

  /** Sent with every request. */
  headers?: HeadersInit;

  /** Enables the refresh-and-retry after a 401. */
  authRecovery?: IAuthRecoveryOptions;
}

/** The token an application is signed in with. */
export interface IAuthTokenRecord {
  /** The authorization scheme; the service sends `Bearer` when it is empty or absent. */
  type?: string;
  value: string;
  provider?: string;
}

/** What an `HttpDataSource` hook reads from the request it is asked about. */
export interface IDataSourceRequestContext {
  paths: Array<string>;
}

/**
 * The settings an `HttpDataSource` takes, bound to one `DefaultNetworkRequestService`, so a
 * repository sends what the data provider sends: the same headers, the same token on the same
 * paths, and one shared refresh per 401 burst. The hooks run on every send, the retry included.
 */
export interface IDataSourceAuth {
  authTokenResolver: (context: IDataSourceRequestContext) => IAuthTokenRecord | undefined;
  headersResolver: (context: IDataSourceRequestContext) => Record<string, string>;
  onUnauthorized: (context: IDataSourceRequestContext) => Promise<boolean>;
  errorRootKey: string;
}

/** What `DefaultNetworkRequestService.doRequest` answers. */
export interface INetworkResponse<TResult = unknown> {
  /** The response body, or its rows for a list. */
  data: TResult;
  /** The count the server sent, in the body or in `x-response-count`; absent when it sent none. */
  count?: number;
  /** GET_LIST and GET_MANY_REFERENCE: the total of `Content-Range`, else the page's own row count. */
  total?: number;
  /** A file response: its name and `Content-Disposition`. */
  filename?: string;
  contentDisposition?: string;
  /** What a route with list extras answered. */
  extra?: Record<string, unknown>;
}

/**
 * A feature package an application mounts: what it registers in the container. The admin package
 * extends it with resources, routes and messages (`TFeature`); the kernel knows no UI.
 */
export interface IFeatureBase {
  /** Unique within an application. */
  name: string;
  /**
   * The feature's `@configuration()` classes, by value. Referencing them keeps a bundler from
   * dropping a module nothing else imports, and `start()` checks each was discovered.
   * @default []
   */
  configurations?: Array<TClass<unknown>>;
  /** What the feature checks, in the application's vocabulary. Declared for a role editor; ARDOR enforces nothing. */
  permissions?: Array<string>;
}

/**
 * The index `ignis-artifacts generate` (from `@venizia/ignis-boot`) emits: every stereotyped class,
 * by value, per kind. Referencing them keeps a bundler from dropping a module nothing else imports,
 * and `start()` checks each was discovered. `controllers` stays empty in a browser application.
 */
export interface IArtifactIndex {
  configurations?: ReadonlyArray<TClass<unknown>>;
  dataSources?: ReadonlyArray<TClass<unknown>>;
  components?: ReadonlyArray<TClass<unknown>>;
  repositories?: ReadonlyArray<TClass<unknown>>;
  services?: ReadonlyArray<TClass<unknown>>;
  controllers?: ReadonlyArray<TClass<unknown>>;
}

/** Answers whether the current actor may act on a resource. Bound by the application under `CoreBindings.PERMISSION_PROVIDER`. */
export interface IPermissionProvider {
  canAccess(opts: { resource: string; action: string; record?: unknown }): Promise<boolean>;
}

/** The contract of an application: lifecycle hooks, registration of artifacts, and `start`. */
export interface IArdorApplication {
  /** Binds the application instance and info, then the discovered, feature and listed classes. */
  preConfigure(): ValueOrPromise<void>;
  /** Runs after `preConfigure` in `start`. */
  postConfigure(): ValueOrPromise<void>;
  /** The application's own bindings, bound last in `preConfigure`. */
  bindContext(): ValueOrPromise<void>;
  /** Classes bound by key as singletons. */
  bindingList(): Record<string, TClass<unknown>>;
  /** The features this application mounts. */
  features(): Array<IFeatureBase>;
  /** The artifact indexes `start` checks every stereotyped class against. */
  artifacts(): Array<IArtifactIndex>;

  /** Binds `value` under `<scope>.<ClassName>` as a singleton. */
  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>): void;
  /** Binds `value` in the service namespace. */
  service<T>(value: TClass<T>): unknown;
  /** Binds `value` in the repository namespace. */
  repository<T>(value: TClass<T>): unknown;
  /** Binds `value` in the data source namespace. */
  dataSource<T>(value: TClass<T>): unknown;
  /** Binds `value` in the component namespace. */
  component<T>(value: TClass<T>): unknown;

  /** Runs the whole startup: resolves the indexes, then `preConfigure`, then `postConfigure`. */
  start(): ValueOrPromise<void>;
}

type TDeepPath = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Values a path stops at: their members are not state. */
type TPathLeaf =
  | Date
  | RegExp
  | ReadonlySet<AnyType>
  | ReadonlyMap<AnyType, AnyType>
  | Promise<AnyType>
  | ((...args: Array<AnyType>) => AnyType);

type TIsAny<TValue> = 0 extends 1 & TValue ? true : false;

/**
 * The dotted paths of an object type, to `DeepLevel` levels (10 by default). An array, a `Date`, a
 * `Set`, a `Map`, a `Promise`, a function and an `any` field are leaves: the path stops at them.
 */
export type TPaths<T, DeepLevel extends number = 10> = DeepLevel extends 0
  ? never
  : T extends Array<AnyType> | TPathLeaf
    ? never
    : T extends object
      ? {
          [K in keyof T]-?: K extends string | number
            ? TIsAny<T[K]> extends true
              ? `${K}`
              : NonNullable<T[K]> extends Array<AnyType> | TPathLeaf
                ? `${K}`
                : NonNullable<T[K]> extends object
                  ? `${K}` | `${K}.${TPaths<NonNullable<T[K]>, TDeepPath[DeepLevel]>}`
                  : `${K}`
            : never;
        }[keyof T]
      : never;

/** The dotted paths of an object type, to `DeepLevel` levels (10 by default); unlike `TPaths`, only the paths down to a leaf value. */
export type TFullPaths<T, DeepLevel extends number = 10> = DeepLevel extends never
  ? never
  : T extends Array<infer U>
    ? TFullPaths<U>
    : T extends object
      ? {
          [K in keyof T]-?: K extends string | number
            ? T[K] extends Array<any> | object
              ? `${K}.${TFullPaths<T[K], TDeepPath[DeepLevel]>}`
              : `${K}`
            : never;
        }[keyof T]
      : never;

/** What an application is: bound under `CoreBindings.APPLICATION_INFO`, and the name a tracing id starts with. */
export interface IApplicationInfo {
  name: string;
  version: string;
  description: string;
  author?: { name: string; email: string; url?: string };
}

/** The `build-info.json` that the `buildInfoFile` Vite plugin of `@venizia/ardor/vite` writes: IGNIS's build stamp and the installed versions of the framework packages. */
export interface IBuildInfoFile extends TBuildInfoRecord {
  frameworks: Record<string, string>;
}
