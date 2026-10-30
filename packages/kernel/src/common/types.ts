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
} from './constants';

/** @deprecated Use `number`. Removed in 0.5. */
export type NumberIdType = number;
/** @deprecated Use `string`. Removed in 0.5. */
export type StringIdType = string;
export type IdType = string | number;
/** @deprecated Write `undefined | null`. Removed in 0.5. */
export type NullableType = undefined | null | void;

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

export type TRequestMethod = TStringConstValue<typeof RequestMethods>;
export type TEnvironment = TStringConstValue<typeof Environments>;

export interface ISendParams {
  method?: TRequestMethod;
  requestType?: TRequestType;
  bodyType?: TRequestBodyType;
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string | number>;
  requestCountData?: TConstValue<typeof RequestCountData>;
  /** The list extras to ask the route for, sent in `x-request-extra`. */
  extra?: TExtraRequest;
}

/** What `IDataProvider.send` answers: the network service's response. */
export type ISendResponse<T = unknown> = INetworkResponse<T>;

export type TRequestBodyType = TStringConstValue<typeof RequestBodyTypes>;
export type TRequestType = TStringConstValue<typeof RequestTypes>;

export interface IGetRequestPropsParams {
  resource: string;
  requestCountData?: TConstValue<typeof RequestCountData>;
  body?: unknown;
  bodyType?: TRequestBodyType;
  restDataProviderOptions: IRestDataProviderOptions;
  applicationInfo: IApplicationInfo;
  /** The list extras to ask the route for, sent in `x-request-extra`. */
  extra?: TExtraRequest;
}

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
    /** Where `login` posts. Default `/auth/sign-in`, the IGNIS auth controller's route. */
    signIn?: string;
    /** Where `checkAuth` validates the stored token. Default: not called; the stored token is enough. */
    checkAuth?: string;
    /** Where the admin goes once `login` resolves. Default `/`. */
    afterLogin?: string;
  };
}

export interface IAuthRecoveryOptions {
  /** A request to this path never starts a refresh: it is the refresh. */
  refreshTokenPath?: string;
}

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

export interface IRestDataProviderOptions extends INoAuthOptions {
  url: string;
  /** Sent in `x-request-channel`. Default `RequestChannel.WEB`. */
  requestTracingChannel?: string;

  headers?: HeadersInit;

  authRecovery?: IAuthRecoveryOptions;
}

export interface IAuthTokenRecord {
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
  data: TResult;
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

export interface IArdorApplication {
  preConfigure(): ValueOrPromise<void>;
  postConfigure(): ValueOrPromise<void>;
  bindContext(): ValueOrPromise<void>;
  bindingList(): Record<string, TClass<unknown>>;
  features(): Array<IFeatureBase>;
  artifacts(): Array<IArtifactIndex>;

  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>): void;
  service<T>(value: TClass<T>): unknown;
  repository<T>(value: TClass<T>): unknown;
  dataSource<T>(value: TClass<T>): unknown;
  component<T>(value: TClass<T>): unknown;

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

/** @deprecated Nothing in ARDOR uses it: declare the shape you need. Removed in 0.5. */
export type TDataCount<T> = {
  data: T;
  count?: number;
};
