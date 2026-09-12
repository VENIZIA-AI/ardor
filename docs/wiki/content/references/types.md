---
title: Types and constants
description: The public type vocabulary of ARDOR - id and escape-hatch aliases, promise and value helpers, const-class value extraction, path types, option interfaces, the service and provider contracts, and the const classes with their SCHEME_SET + isValid pattern.
---

# Types and constants

## Prerequisites

You have a running ARDOR app (see the [quickstart](../guides/get-started/quickstart)) and you know that everything below is imported from `@venizia/ardor`.

## Quick Reference

| Export | Kind | What it is |
| --- | --- | --- |
| `IdType`, `NumberIdType`, `StringIdType`, `NullableType` | type | Entity id and nullable aliases |
| `AnyType`, `AnyObject` | type | Named escape hatches for `any` and loose records |
| `ValueOrPromise<T>` | type | `T \| Promise<T>` |
| `ValueOf<T>`, `ClassProps<T>` | type | Union of the values of `T` |
| `ValueOptional`, `ValueOptionalExcept`, `TPrettify` | type | Object shaping helpers |
| `ClassType<T>` | type | A function with a `prototype` of `T` |
| `TStatusFromClass`, `TConstValue`, `TStringConstValue`, `TNumberConstValue` | type | Value unions from a const class |
| `TRequestMethod`, `TRequestType`, `TRequestBodyType`, `TEnvironment` | type | Prebuilt unions from the const classes |
| `TPaths<T>`, `TFullPaths<T>` | type | Dotted path unions over an object type |
| `IApplicationInfo` | interface | Name, version, description, author |
| `ISendParams`, `ISendResponse<T>` | interface | Input and output of `dataProvider.send` |
| `IRequestProps`, `IGetRequestPropsParams`, `IGetRequestPropsResult`, `ICustomParams` | interface | Request building types used by the network layer |
| `IRestDataProviderOptions` | interface | REST data provider options (extends `INoAuthOptions`) |
| `INoAuthOptions`, `TNoAuthPathRegex` | interface, type | Which paths are sent without an authorization header |
| `IAuthRecoveryOptions` | interface | Refresh token and failure hooks |
| `IAuthProviderOptions` | interface | Auth provider endpoints and paths |
| `II18nProviderOptions` | interface | i18n sources and language list |
| `IService`, `ICrudService<E>` | interface | Service marker and CRUD contract |
| `IReactAdminDataProvider`, `IDataProvider` | interface | react-admin data contract plus `send` and `getNetworkService` |
| `IReactAdminAuthProvider`, `IAuthProvider` | interface | react-admin auth contract plus `getRoles` and `refreshToken` |
| `IArdorApplication`, `IApplication` | interface | Application lifecycle and `<ArdorApplication>` props |
| `TDataCount<T>`, `EntityRelationType` | type | Data with optional count; relation placeholder |
| `RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `Environments` | class | Const classes with `SCHEME_SET` and `isValid` |
| `RequestCountData`, `HeaderConsts`, `RequestChannel`, `Authentication`, `App` | class | Const classes without a scheme set |

## Id and nullable aliases

`IdType` is the id type used by every CRUD and provider contract. `NumberIdType` and `StringIdType` narrow it when a service knows its id shape. `NullableType` names the three "no value" cases.

```ts no-check
export type NumberIdType = number;
export type StringIdType = string;
export type IdType = string | number;
export type NullableType = undefined | null | void;
```

```ts
import type { IdType } from '@venizia/ardor';

export interface Product {
  id: IdType;
  name: string;
}

export const byId = (opts: { items: Array<Product>; id: IdType }) =>
  opts.items.find(item => item.id === opts.id);
```

## AnyType and AnyObject

`AnyType` is `any` under a name. `AnyObject` is a record with any keys and any values. They exist so that the places where the framework gives up type precision are explicit and searchable, instead of a bare `any` scattered through signatures. The framework uses them as generic defaults (`ISendResponse<T = AnyType>`, the `RecordType` defaults of `IDataProvider`) and for untyped inputs (`ISendParams.body`, `IAuthProvider.login(params: AnyType)`).

```ts no-check
export type AnyType = any;
export type AnyObject = Record<string | symbol | number, any>;
```

Use them at the same boundaries in your own code - untyped payloads, generic defaults - and give your domain types real shapes.

```ts
import type { AnyObject } from '@venizia/ardor';

export const pick = (opts: { source: AnyObject; keys: Array<string> }) =>
  Object.fromEntries(opts.keys.map(key => [key, opts.source[key]]));
```

## ValueOrPromise

A value that may or may not be wrapped in a promise. The application lifecycle hooks (`preConfigure`, `postConfigure`, `bindContext`, `start` on `IArdorApplication`) and `IAuthRecoveryOptions.onAuthFailure` use it, so you can implement them synchronously or with `async`.

```ts no-check
export type ValueOrPromise<T> = T | Promise<T>;
```

```ts
import type { ValueOrPromise } from '@venizia/ardor';

export const resolve = async <T>(opts: { value: ValueOrPromise<T> }): Promise<T> =>
  await opts.value;
```

## ValueOf and the object shaping helpers

`ValueOf<T>` is the union of the property types of `T`. `ClassProps<T>` is an alias for it. Three helpers reshape object types: `ValueOptional` makes the listed keys optional, `ValueOptionalExcept` makes everything optional except the listed keys, and `TPrettify` flattens an intersection so editors show one object.

```ts no-check
export type ValueOf<T> = T[keyof T];
export type ClassProps<T> = ValueOf<T>;
export type ValueOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type ValueOptionalExcept<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;
export type TPrettify<T> = { [K in keyof T]: T[K] } & {};
export type ClassType<T> = Function & { prototype: T };
```

```ts
import type { TPrettify, ValueOf, ValueOptional, ValueOptionalExcept } from '@venizia/ardor';

export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

export type UserField = ValueOf<User>;
// string | number

export type UserInput = TPrettify<ValueOptional<User, 'email' | 'age'>>;
// { id: string; name: string; email?: string; age?: number }

export type UserPatch = TPrettify<ValueOptionalExcept<User, 'id'>>;
// { id: string; name?: string; email?: string; age?: number }
```

## TStatusFromClass and TConstValue

ARDOR keeps its enums as classes with `static readonly` literal members. These types turn such a class into a union of its values.

- `TStatusFromClass<T>` takes `ValueOf` over the class and drops `prototype`, `isValid`, `SCHEME_SET` and `TYPE_SET`, so only the constants remain.
- `TConstValue<T>` keeps the string and number values only. `TStringConstValue` and `TNumberConstValue` keep one of the two.

```ts no-check
export type TStatusFromClass<T extends ClassType<AnyObject>> = ValueOf<
  Omit<T, 'prototype' | 'isValid' | 'SCHEME_SET' | 'TYPE_SET'>
>;
export type TStringConstValue<T extends ClassType<any>> = Extract<ValueOf<T>, string>;
export type TNumberConstValue<T extends ClassType<any>> = Extract<ValueOf<T>, number>;
export type TConstValue<T extends ClassType<any>> = Extract<ValueOf<T>, string | number>;
```

The prebuilt unions are `TRequestMethod` (from `RequestMethods`), `TEnvironment` (from `Environments`), `TRequestType` (from `RequestTypes`) and `TRequestBodyType` (from `RequestBodyTypes`).

```ts
import { RequestCountData, RequestMethods, type TConstValue, type TStatusFromClass } from '@venizia/ardor';

export type Method = TStatusFromClass<typeof RequestMethods>;
// 'HEAD' | 'OPTIONS' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type CountMode = TConstValue<typeof RequestCountData>;
// '0' | '1'
```

## TPaths and TFullPaths

Both produce a union of dotted paths over an object type, up to 10 levels deep. They differ in what they emit for nested objects and arrays.

- `TPaths<T>` emits every key, including intermediate object keys (`customer` and `customer.name`). An array-valued key stops the walk: you get `lines`, never `lines.sku`. Optional and nullable properties are unwrapped with `NonNullable` before recursion. A top-level array gives `never`.
- `TFullPaths<T>` emits leaf paths only. An object-valued key never appears on its own. An array-valued key recurses into the element type, so `lines` becomes `lines.sku` and `lines.qty`. A top-level array is unwrapped to its element type.

```ts no-check
export type TPaths<T, DeepLevel extends number = 10> = /* keys, stops at arrays */ never;
export type TFullPaths<T, DeepLevel extends number = 10> = /* leaves, walks into arrays */ never;
```

```ts
import type { TFullPaths, TPaths } from '@venizia/ardor';

export interface Order {
  id: number;
  customer: { name: string; address: { city: string } };
  lines: Array<{ sku: string; qty: number }>;
}

export type OrderPath = TPaths<Order>;
// 'id' | 'customer' | 'customer.name' | 'customer.address' | 'customer.address.city' | 'lines'

export type OrderLeaf = TFullPaths<Order>;
// 'id' | 'customer.name' | 'customer.address.city' | 'lines.sku' | 'lines.qty'
```

Pick `TPaths` when you need to name a container (a sort field, a group key). Pick `TFullPaths` when you need to name a value inside a list.

## IApplicationInfo

Identity of the app. It is passed to the request builder (`IGetRequestPropsParams.applicationInfo`) and to the `requestTracingId` callback of the REST options. Extra keys are allowed.

```ts no-check
export interface IApplicationInfo {
  name: string;
  version: string;
  description: string;
  author?: { name: string; email: string; url?: string };
  [extra: string | symbol]: any;
}
```

```ts
import type { IApplicationInfo } from '@venizia/ardor';

export const applicationInfo: IApplicationInfo = {
  name: 'shop-admin',
  version: '1.4.0',
  description: 'Back office for the shop',
  author: { name: 'Shop team', email: 'team@example.com' },
};
```

## ISendParams and ISendResponse

`ISendParams` is the input of `dataProvider.send`. Every field is optional and unknown keys are allowed. `method`, `requestType`, `bodyType` and `requestCountData` are typed from the const classes below. `ISendResponse<T>` wraps the payload under `data` and allows extra keys.

```ts no-check
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
```

```ts
import { RequestBodyTypes, RequestMethods, type ISendParams } from '@venizia/ardor';

export const exportParams: ISendParams = {
  method: RequestMethods.POST,
  bodyType: RequestBodyTypes.JSON,
  body: { ids: [1, 2, 3] },
  query: { format: 'csv' },
};
```

The related request building types are `IRequestProps` (headers, body, query), `IGetRequestPropsParams` and `IGetRequestPropsResult` (input and output of header and body preparation), and `ICustomParams` (an optional `params` bag merged into react-admin params). See [network](../references/network).

## INoAuthOptions

Controls when the authorization header is attached.

- `useAuth` - defaults to `true`. Set `false` for apps that only call public APIs.
- `noAuthPaths` - exact resource paths sent without the header.
- `noAuthPathRegex` - one or more patterns. A string is compiled with `new RegExp(...)`.

```ts no-check
export type TNoAuthPathRegex = string | RegExp | Array<string | RegExp>;

export interface INoAuthOptions {
  useAuth?: boolean;
  noAuthPaths?: Array<string>;
  noAuthPathRegex?: TNoAuthPathRegex;
}
```

## IAuthRecoveryOptions

Hooks the network layer uses when a request fails on authentication.

```ts no-check
export interface IAuthRecoveryOptions {
  refreshToken?: () => Promise<unknown>;
  onAuthFailure?: () => ValueOrPromise<unknown>;
  refreshTokenPath?: string;
}
```

`refreshToken` runs a refresh, `refreshTokenPath` names the refresh endpoint, and `onAuthFailure` runs when recovery is not possible. See [auth provider](../references/auth-provider).

## IRestDataProviderOptions

Options of the REST data provider. It extends `INoAuthOptions` and adds the base `url`, default `headers`, request tracing and auth recovery.

- `requestTracingId` - `true` to attach a tracing id, or a function `({ applicationInfo }) => string` that produces it.
- `requestTracingChannel` - the channel value sent with the request.

```ts no-check
export interface IRestDataProviderOptions extends INoAuthOptions {
  url: string;
  requestTracingId?: boolean | ((opts: { applicationInfo: IApplicationInfo }) => string);
  requestTracingChannel?: string;
  headers?: HeadersInit;
  authRecovery?: IAuthRecoveryOptions;
}
```

```ts
import { HeaderConsts, RequestChannel, type IRestDataProviderOptions } from '@venizia/ardor';

export const restOptions: IRestDataProviderOptions = {
  url: 'https://api.example.com',
  headers: { [HeaderConsts.X_LOCALE]: 'en' },
  requestTracingId: true,
  requestTracingChannel: RequestChannel.WEB,
  noAuthPaths: ['auth/sign-in'],
  noAuthPathRegex: [/^public\//],
  authRecovery: {
    refreshTokenPath: 'auth/refresh',
    onAuthFailure: () => console.warn('session expired'),
  },
};
```

Bind the object under the key listed in [binding keys](../references/binding-keys). Behaviour of each field is covered in [data provider](../references/data-provider).

## IAuthProviderOptions

Options of the default auth provider. `endpoints.afterLogin` is the route to go to after login. `paths` are the API paths for sign in, sign up and auth check.

```ts no-check
export interface IAuthProviderOptions {
  endpoints?: {
    afterLogin?: string;
  };
  paths?: {
    signIn?: string;
    signUp?: string;
    checkAuth?: string;
  };
}
```

```ts
import type { IAuthProviderOptions } from '@venizia/ardor';

export const authOptions: IAuthProviderOptions = {
  endpoints: { afterLogin: '/dashboard' },
  paths: {
    signIn: 'auth/sign-in',
    checkAuth: 'auth/who-am-i',
  },
};
```

`II18nProviderOptions` (`i18nSources`, `listLanguages`) follows the same shape and is documented in [i18n](../references/i18n).

## ICrudService

The CRUD contract a service exposes for one entity. `E` must have an `id: IdType`. `IService` is the empty marker it extends. Filters and where clauses use `TFilter` and `TWhere` from `@venizia/ignis-filter`; they are not re-exported by `@venizia/ardor`.

```ts no-check
export interface ICrudService<
  E extends { id: IdType; [extra: string | symbol]: any } = any,
> extends IService {
  find(filter: TFilter<E>): Promise<Array<E & EntityRelationType>>;
  findById(id: IdType, filter: TFilter<E>): Promise<E & EntityRelationType>;
  findOne(filter: TFilter<E>): Promise<(E & EntityRelationType) | null>;
  count(where: TWhere<E>): Promise<{ count: number }>;

  create(data: Omit<E, 'id'>): Promise<E>;
  updateAll(data: Partial<E>, where: TWhere<E>): Promise<{ count: number }>;
  updateById(id: IdType, data: Partial<E>): Promise<E>;
  replaceById(id: IdType, data: E): Promise<E>;
  deleteById(id: IdType): Promise<{ id: IdType }>;
}
```

```ts no-check
import type { ICrudService } from '@venizia/ardor';

interface Product {
  id: number;
  name: string;
  price: number;
}

export const rename = async (opts: { products: ICrudService<Product>; id: number; name: string }) => {
  const { products, id, name } = opts;
  const existing = await products.findById(id, { ... });
  return products.updateById(existing.id, { name });
};
```

`BaseCrudService` implements this interface; see [data provider](../references/data-provider).

## IDataProvider and IAuthProvider

Both contracts are react-admin's interface plus ARDOR extensions.

`IReactAdminDataProvider<TResource>` is the nine react-admin methods, called with positional `(resource, params)`. `params` is react-admin's own params type intersected with `QueryFunctionContext` and `ICustomParams`. `IDataProvider` adds two methods:

- `send({ resource, params })` - an arbitrary request, typed by `ISendParams` and returning `ISendResponse<ReturnType>`. This one takes an options object.
- `getNetworkService()` - the `DefaultNetworkRequestService` behind the provider.

```ts no-check
export interface IDataProvider<TResource extends string = string>
  extends IReactAdminDataProvider<TResource> {
  send: <ReturnType = AnyType>(opts: {
    resource: TResource;
    params: ISendParams;
  }) => Promise<ISendResponse<ReturnType>>;

  getNetworkService(): DefaultNetworkRequestService;
}
```

```ts
import { RequestMethods, type IDataProvider } from '@venizia/ardor';

export const exportFirstPage = async (opts: { dataProvider: IDataProvider }) => {
  const { dataProvider } = opts;

  // react-admin contract: positional (resource, params)
  const list = await dataProvider.getList('products', {
    pagination: { page: 1, perPage: 10 },
    sort: { field: 'id', order: 'ASC' },
    filter: {},
  });

  // ARDOR extension: options object
  const exported = await dataProvider.send<{ url: string }>({
    resource: 'products/export',
    params: { method: RequestMethods.POST, body: { ids: list.data.map(record => record.id) } },
  });

  return exported.data.url;
};
```

`IReactAdminAuthProvider` is react-admin's auth contract (`login`, `logout`, `checkAuth`, `checkError`, optional `getIdentity`, `getPermissions`). `IAuthProvider` adds `getRoles`, which resolves to a `Set<string>`, and `refreshToken`.

```ts no-check
export interface IAuthProvider extends IReactAdminAuthProvider {
  getRoles: (params?: AnyType) => Promise<Set<string>>;
  refreshToken: () => Promise<AnyType>;
}
```

```ts
import type { IAuthProvider } from '@venizia/ardor';

export const canManage = async (opts: { authProvider: IAuthProvider }) => {
  const roles = await opts.authProvider.getRoles();
  return roles.has('admin');
};
```

How to obtain both from the container is covered in [data provider](../references/data-provider), [auth provider](../references/auth-provider) and [hooks](../references/hooks). `IArdorApplication` (the lifecycle contract) and `IApplication` (the props of `ArdorApplication`) are documented in [application](../references/application).

## Const classes and the SCHEME_SET + isValid pattern

ARDOR does not use TypeScript `enum`. Each group of constants is a class with `static readonly` members. Four of them also carry a `SCHEME_SET` (a `Set` of every member) and a static `isValid(input: string): boolean` that checks membership at runtime. Pair `isValid` with `TStatusFromClass` when you need both a runtime check and a compile-time union from the same source.

| Class | Members | `SCHEME_SET` + `isValid` |
| --- | --- | --- |
| `RequestMethods` | `HEAD`, `OPTIONS`, `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | yes |
| `RequestTypes` | `SEND`, `GET_LIST`, `GET_ONE`, `GET_MANY`, `GET_MANY_REFERENCE`, `CREATE`, `UPDATE`, `UPDATE_MANY`, `DELETE`, `DELETE_MANY` | yes |
| `RequestBodyTypes` | `NONE` (`'none'`), `FORM_DATA` (`'form-data'`), `FORM_URL_ENCODED` (`'x-www-form-urlencoded'`), `JSON` (`'json'`), `BINARY` (`'binary'`) | yes |
| `Environments` | `DEVELOPMENT` (`'development'`), `PRODUCTION` (`'production'`) | yes |
| `RequestCountData` | `DATA_ONLY` (`'0'`), `DATA_WITH_COUNT` (`'1'`) | no |
| `HeaderConsts` | header names, see below | no |
| `RequestChannel` | `WEB` (`'100_WEB'`) | no |
| `Authentication` | `TYPE_BASIC`, `TYPE_BEARER`, `STRATEGY_BASIC`, `STRATEGY_JWT` | no |
| `App` | `TIMEZONE`, `TIMEZONE_OFFSET`, `DEFAULT_LOCALE`, `DEFAULT_DEBOUNCE_TIME` | no |

```ts no-check
export class RequestMethods {
  static readonly GET = 'GET';
  // ...
  static readonly SCHEME_SET = new Set([this.HEAD, this.OPTIONS, this.GET, this.POST, this.PUT, this.PATCH, this.DELETE]);
  static isValid(input: string): boolean {
    return this.SCHEME_SET.has(input);
  }
}
```

```ts
import { Environments, RequestMethods, type TEnvironment, type TRequestMethod } from '@venizia/ardor';

export const toMethod = (opts: { raw: string }): TRequestMethod => {
  if (!RequestMethods.isValid(opts.raw)) {
    throw new Error(`Unsupported method: ${opts.raw}`);
  }
  return opts.raw as TRequestMethod;
};

export const toEnvironment = (opts: { raw: string }): TEnvironment =>
  Environments.isValid(opts.raw) ? (opts.raw as TEnvironment) : Environments.DEVELOPMENT;
```

`RequestCountData` selects what the server puts in the body: `DATA_ONLY` returns only the data, `DATA_WITH_COUNT` returns data and count. It travels in the `HeaderConsts.REQUEST_COUNT_DATA` header and is the type of `ISendParams.requestCountData`. `TDataCount<T>` (`{ data: T; count?: number }`) is the matching result shape.

`HeaderConsts` names every header the network layer reads or writes:

| Member | Value |
| --- | --- |
| `CONTENT_TYPE` | `content-type` |
| `CONTENT_RANGE` | `content-range` (`unit start-end/total`) |
| `CONTENT_DISPOSITION` | `content-disposition` |
| `AUTHORIZATION` | `authorization` |
| `X_AUTH_PROVIDER` | `x-auth-provider` |
| `X_LOCALE` | `x-locale` |
| `TIMEZONE` | `Timezone` |
| `TIMEZONE_OFFSET` | `Timezone-Offset` |
| `REQUEST_TRACING_ID` | `x-request-id` |
| `REQUEST_DEVICE_INFO` | `x-device-info` |
| `REQUEST_CHANNEL` | `x-request-channel` |
| `REQUEST_COUNT_DATA` | `x-request-count` |
| `RESPONSE_COUNT_DATA` | `x-response-count` |
| `RESPONSE_FORMAT` | `x-response-format` |
| `TEXTUAL_CONTENT_TYPE_RE` | regex matching JSON, XML, form, javascript, graphql and `text/*` content types |
| `ATTACHMENT_CONTENT_DISPOSITION_RE` | regex matching `attachment` dispositions |

`App` holds runtime defaults: `TIMEZONE` is the browser's IANA zone, `TIMEZONE_OFFSET` is the offset in hours, `DEFAULT_LOCALE` is `'en.UTF-8'`, and `DEFAULT_DEBOUNCE_TIME` is `500` milliseconds.

```ts
import { App, HeaderConsts } from '@venizia/ardor';

export const timezoneHeaders = (): Record<string, string> => ({
  [HeaderConsts.TIMEZONE]: App.TIMEZONE,
  [HeaderConsts.TIMEZONE_OFFSET]: String(App.TIMEZONE_OFFSET),
});
```

## Common pitfalls

- `isValid` returns `boolean`, not a type guard. It does not narrow `string` to the union; cast after the check, as in the example above.
- `TPaths` never descends into arrays and `TFullPaths` never emits an intermediate object key. Using one where you meant the other gives a union that silently misses the path you wanted.
- `IDataProvider` is positional on purpose. Only `send` takes an options object, because it is an ARDOR extension and not part of the react-admin contract.
- `INoAuthOptions.noAuthPaths` is an exact match. Use `noAuthPathRegex` for prefixes, and remember a string pattern is compiled with `new RegExp(...)`.
- `AnyType` is `any`. It is fine as a generic default at a boundary; do not let it become the type of your domain records.
- `TFilter` and `TWhere` used by `ICrudService` are not on the `@venizia/ardor` surface. Import them from `@venizia/ignis-filter`.
- `IAuthProviderOptions` carries no defaults in its type. What happens when a path is missing is decided by the provider, see [auth provider](../references/auth-provider).
- `TStatusFromClass` drops `SCHEME_SET`, `isValid`, `prototype` and `TYPE_SET`. Any other static you add to a const class becomes part of the union.

## Related

- [Application](../references/application) - `IArdorApplication`, `IApplication`, lifecycle hooks
- [Binding keys](../references/binding-keys) - where the option objects are bound
- [Data provider](../references/data-provider) - `IDataProvider`, `IRestDataProviderOptions` in use
- [Auth provider](../references/auth-provider) - `IAuthProvider`, `IAuthProviderOptions`, `IAuthRecoveryOptions`
- [i18n](../references/i18n) - `II18nProviderOptions`
- [Network](../references/network) - request building with `ISendParams` and `HeaderConsts`
- [Hooks](../references/hooks) - resolving providers from components
- [Module augmentation](../best-practices/module-augmentation) - extending key unions
