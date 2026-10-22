import type { TClass } from '@venizia/ignis-inversion';
import type { TExtraRequest } from '@venizia/ignis-kernel/repository';

import type {
  Environments,
  RequestBodyTypes,
  RequestCountData,
  RequestMethods,
  RequestTypes,
} from './constants';

export type NumberIdType = number;
export type StringIdType = string;
export type IdType = string | number;
export type NullableType = undefined | null | void;

export type AnyType = any;
export type AnyObject = Record<string | symbol | number, any>;

export type ValueOrPromise<T> = T | Promise<T>;
export type ValueOf<T> = T[keyof T];

export type ValueOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type ValueOptionalExcept<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;

// `& {}` turns the widening literals of `static readonly` members into regular ones, so a value
// copied into an object literal or a `let` keeps its union instead of widening to string/number.
export type TStringConstValue<T extends TClass<any>> = Extract<ValueOf<T>, string> & {};
export type TNumberConstValue<T extends TClass<any>> = Extract<ValueOf<T>, number> & {};
export type TConstValue<T extends TClass<any>> = Extract<ValueOf<T>, string | number> & {};

export type TPrettify<T> = { [K in keyof T]: T[K] } & {};

export type TRequestMethod = TStringConstValue<typeof RequestMethods>;
export type TEnvironment = TStringConstValue<typeof Environments>;

export interface IRequestProps {
  headers?: { [key: string]: string | number };
  body?: any;
  query?: any;
}

export interface ISendParams {
  id?: string | number;
  method?: TRequestMethod;
  requestType?: TRequestType;
  bodyType?: TRequestBodyType;
  body?: any;
  file?: any;
  query?: { [key: string]: any };
  headers?: { [key: string]: string | number };
  requestCountData?: TConstValue<typeof RequestCountData>;
  [key: string]: any;
}

export interface ISendResponse<T = AnyType> {
  data: T;
  [key: string]: any;
}

export type TRequestBodyType = TStringConstValue<typeof RequestBodyTypes>;
export type TRequestType = TStringConstValue<typeof RequestTypes>;

export interface IGetRequestPropsParams {
  resource: string;
  requestCountData?: TConstValue<typeof RequestCountData>;
  body?: any;
  bodyType?: TRequestBodyType;
  restDataProviderOptions: IRestDataProviderOptions;
  applicationInfo: IApplicationInfo;
  /** The list extras to ask the route for, sent in `x-request-extra`. */
  extra?: TExtraRequest;
}

export interface IGetRequestPropsResult {
  headers?: HeadersInit;
  body?: any;
}

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
  /** Sent in `x-request-channel`. Default `web`. */
  requestTracingChannel?: string;

  headers?: HeadersInit;

  authRecovery?: IAuthRecoveryOptions;
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
  [extra: string | symbol]: any;
}

export type TDataCount<T> = {
  data: T;
  count?: number;
};
