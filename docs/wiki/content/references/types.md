---
title: Types
description: The main public types of ARDOR grouped by package, each described on one line, with where it is used across kernel, react, and admin.
---

# Types

This page lists the main public types of ARDOR, not every exported type (the hook option and return interfaces are on the [hooks page](./hooks)), across three packages: `@venizia/ardor-kernel` (primitives, constants, network options, and repositories), `@venizia/ardor-react` (React context and hooks), and `@venizia/ardor-admin` (react-admin providers and application components). All symbols can be imported directly from `@venizia/ardor` (or `@venizia/ardor/repository` for repository classes and datasource settings).

```ts
import type { IdType, ISendParams, ValueOrPromise } from '@venizia/ardor';

export interface UserItem {
  id: IdType;
  title: string;
}

export const loadUser = (opts: { id: IdType }): ValueOrPromise<UserItem> => {
  return { id: opts.id, title: 'Sample' };
};

export const exportParams: ISendParams = {
  query: { format: 'json' },
};
```

## @venizia/ardor-kernel

Source files: `packages/kernel/src/common/types.ts`, `packages/kernel/src/common/constants.ts`, `packages/kernel/src/common/keys.ts`, and `packages/kernel/src/base/services/network-request.ts`.

### Primitives and value helpers

| Type | Kind | Definition and usage |
|---|---|---|
| `IdType` | `type` | Entity identifier (`string \| number`), used by all CRUD and provider method signatures. |
| `ValueOrPromise<T>` | `type` | Sync or async value (`T \| Promise<T>`), used in `preConfigure`, `postConfigure`, `bindContext` and `getAppInfo`. |
| `ValueOf<T>` | `type` | Property value union (`T[keyof T]`), used to extract property value types from objects. |
| `ValueOptional<T, K>` | `type` | Makes keys `K` optional in `T`, used to model partial creation payloads. |
| `ValueOptionalExcept<T, K>` | `type` | Makes all keys optional in `T` except `K`, used to model patch payloads. |
| `TPrettify<T>` | `type` | Flattens intersection types into a single object shape for editor hints. |
| `TConstValue<T>` | `type` | Extracts string and number literal unions from a const class with regular literal types (`& {}`). |
| `TStringConstValue<T>` | `type` | Extracts string literal unions from a const class with regular literal types (`& {}`). |
| `TNumberConstValue<T>` | `type` | Extracts numeric literal unions from a const class with regular literal types (`& {}`). |
| `TPaths<T>` | `type` | Dotted path union over object keys up to 10 levels deep, stopping at arrays. |
| `TFullPaths<T>` | `type` | Dotted leaf path union over object keys up to 10 levels deep, descending into arrays. |

```ts
import type { IdType, TFullPaths, TPaths, ValueOf, ValueOptional } from '@venizia/ardor';

export interface UserRecord {
  id: IdType;
  name: string;
  email?: string;
  meta: { role: string };
}

export type UserValues = ValueOf<UserRecord>;
export type NewUser = ValueOptional<UserRecord, 'email'>;
export type UserPath = TPaths<UserRecord>;
export type UserLeaf = TFullPaths<UserRecord>;
```

### Network and options

| Type | Kind | Definition and usage | Shape |
|---|---|---|---|
| `TRequestType` | `type` | Operation types union (`RequestTypes`), used by data provider operations. | - |
| `TRequestBodyType` | `type` | Payload format union, used in requests. | `'none' \| 'form-data' \| 'x-www-form-urlencoded' \| 'json' \| 'binary'` |
| `TEnvironment` | `type` | Environment names union, used for runtime environment checks. | `'development' \| 'production'` |
| `IRequestPayload` | `interface` | A request body before it is encoded: the `payload` of `ISendParams`. | `data`, `type` (a `RequestBodyTypes` value) |
| `ISendParams` | `interface` | Parameters object for `dataProvider.send`, used for arbitrary endpoint calls. | `method`, `requestType`, `payload`, `query`, `headers`, `requestCountData`, `extra`, `signal` |
| `INetworkResponse<T>` | `interface` | Envelope returned by `dataProvider.send` and the network service. | `data`, and `total`, `count`, `filename`, `contentDisposition`, `extra` where the response has them |
| `IGetRequestPropsParams` | `interface` | Inputs to `getRequestProps`, used by `DefaultNetworkRequestService`. | - |
| `IGetRequestPropsResult` | `interface` | Output headers and body from `getRequestProps`, used by network request callers. | - |
| `ICustomParams` | `interface` | Parameter bag merged into react-admin calls via `params`. | - |
| `INoAuthOptions` | `interface` | Unauthenticated paths configuration, used in network services. | `paths`, e.g. `['/auth/sign-in']`; `regex` |
| `TNoAuthPathRegex` | `type` | Regex patterns matched against no-auth request paths. | `string \| RegExp \| Array<string \| RegExp>` |
| `IAuthRecoveryOptions` | `interface` | Configuration for session refresh endpoint, used in network auth recovery. | `refreshTokenPath`, e.g. `'/auth/refresh'` |
| `IRestDataProviderOptions` | `interface` | Configuration options for REST data provider (URL, headers, channel, auth recovery, no-auth). | - |
| `ISignInSession` | `interface` | Session data extracted on login, used in sign-in lifecycle hooks. | `userId`, `token`, `roles` |
| `TAuthProviderOptions` | `type` | The value of `CoreBindings.AUTH_PROVIDER_OPTIONS`: `{ use: false }`, or `{ use: true }` with the paths below. | `use`, `paths` |
| `IAuthProviderOptions` | `interface` | Auth provider endpoint paths, the `use: true` half of `TAuthProviderOptions`. | `paths.signIn`, e.g. `'/auth/sign-in'`; `paths.checkAuth`; `paths.afterLogin` |
| `IAuthTokenRecord` | `interface` | Auth token payload, returned by `resolveAuthToken()`. | `value`, `type`, `provider` |
| `IStoredAuthUser` | `interface` | The stored identity `getUser()` returns; every field is absent when nothing is stored; it has no index signature. | `userId`, `username`, `referenceId`, `provider` |
| `IDataSourceRequestContext` | `interface` | Request context supplied to `HttpDataSource` auth hooks. | `paths` |
| `IDataSourceAuth` | `interface` | Bridge settings returned by `getDataSourceAuth()`. | `resolvers` (`authToken`, `headers`), `onUnauthorized`, `errorRootKey` |
| `IApplicationInfo` | `interface` | Application metadata, bound under `CoreBindings.APPLICATION_INFO`. | `name`, `version`, `description`, `id`, `author`; extends IGNIS's `IApplicationInfo`, so your own keys read as `unknown` |
| `IFeatureBase` | `interface` | Base feature configuration, bound under `CoreBindings.FEATURES`. | `name`, `configurations`, `artifacts`, `permissions` |
| `IArdorArtifactIndex` | `interface` | Artifact registry index emitted by code generation and verified at application `start()`. | - |
| `IPermissionProvider` | `interface` | Authorization checker contract, bound under `CoreBindings.PERMISSION_PROVIDER`. | `canAccess` |
| `IArdorApplication` | `interface` | Application lifecycle contract implemented by `AbstractArdorApplication`. | - |

`ISendParams` names every field it accepts: a typo is a compile error.

### Const classes

| Class | Kind | Definition and usage | Shape |
|---|---|---|---|
| `CoreBindings` | `class` | The twelve container keys, each made by `BindingKeys.build<T>` with the type of its value. | - |
| `ICoreBindingTypes` | `interface` | Empty in the kernel. `@venizia/ardor-admin` merges the types of the provider keys and the i18n options into it. | `restDataProvider`, `authProvider`, `i18nProvider`, `i18nProviderOptions` (merged) |
| `TCoreBindingType<TName>` | `type` | The type merged into `ICoreBindingTypes` under `TName`, or `unknown` when nothing merged it. | - |
| `LocalStorageKeys` | `class` | The local storage keys for tokens, identities, and permissions, and the three prefixes. | `KEY_AUTH_*`, `PREFIX_AUTH`, `PREFIX_STORE`, `PREFIX_PREFS` |
| `RequestTypes` | `class` | Data operation constants; extends `ConstClass`, so `values()` and `isValid`. | `SEND`, and the nine react-admin verbs from `GET_LIST` to `DELETE_MANY` |
| `RequestBodyTypes` | `class` | Request body formats; extends `ConstClass`, so `values()` and `isValid`. | `NONE`, `FORM_DATA`, `FORM_URL_ENCODED`, `JSON`, `BINARY` |
| `Environments` | `class` | Environment constants; extends `ConstClass`, so `values()` and `isValid`. | `DEVELOPMENT`, `PRODUCTION` |
| `RequestCountData` | `class` | Count mode constants; extends `ConstClass`, so `values()` and `isValid`. | `DATA_ONLY: '0'`, `DATA_WITH_COUNT: '1'` |
| `RequestChannel` | `class` | Client channel constant; extends `ConstClass`, so `values()` and `isValid`. | `WEB: '100_WEB'` |
| `App` | `class` | Runtime defaults: the timezone, its offset and the debounce time. | `TIMEZONE`, `TIMEZONE_OFFSET`, `DEFAULT_DEBOUNCE_TIME` |

### Repositories (@venizia/ardor/repository)

Source files: `packages/ardor/src/repository/index.ts` and `packages/kernel/src/base/repositories/index.ts`.

| Type | Kind | Definition and usage | Shape |
|---|---|---|---|
| `HttpDataSource` | `class` | Transport class managing HTTP requests for repositories. | - |
| `HttpRepository<E, P>` | `class` | Typed CRUD repository reading and writing a backend resource. | - |
| `IHttpDataSourceSettings` | `interface` | Constructor options for `HttpDataSource`. | `baseUrl`, headers, auth token, resolvers, retry hook |
| `IHttpReadResult<R>` | `interface` | Response from `HttpDataSource.read` containing rows, range flag, and count. | - |
| `IHttpWriteResult<R>` | `interface` | Response from `HttpDataSource.write` containing affected rows, count, and extras. | - |
| `IHttpCallOptions` | `interface` | Per-request options accepted by repository calls. | `headers`, `signal` |
| `IAuthToken` | `interface` | Authentication token shape accepted by `HttpDataSource`. | `value`, `type`, `provider` |
| `THttpHeaders` | `type` | Header inputs accepted by `HttpDataSource`. | `Headers \| Array<[string, string]> \| Record<string, string>` |
| `THttpBody` | `type` | Request body types accepted by `HttpDataSource`. | `string \| object` |
| `TExtraRequest` | `type` | Request specification for list extras (`x-request-extra`). | - |
| `TExtraResult<T>` | `type` | Type extraction helper for list extras returned in `x-response-extra`. | - |
| `HttpExtraRequest` | `class` | Utility converting list extra definitions into `x-request-extra` header values. | - |

## @venizia/ardor-react

Source file: `packages/react/src/hooks/use-injectable.ts`.

| Type | Kind | Definition and usage | Shape |
|---|---|---|---|
| `TUseInjectableOptions` | `type` | Options discriminated union (`key` or `target`) accepted by `useInjectable`. | - |
| `IUseInjectableByTarget<TInstance>` | `interface` | Options by class; the return type is the instance type of `target`. | - |
| `IUseInjectableByKey<TValue>` | `interface` | Options by key: `{ key: TBindingKey<TValue>, container? }`; the return type is `TValue`. | - |

## @venizia/ardor-admin

Source files: `packages/admin/src/common/types.ts` and `packages/admin/src/features/feature.ts`.

| Type | Kind | Definition and usage | Shape |
|---|---|---|---|
| `IReactAdminDataProvider<TResource>` | `type` | Nine standard react-admin data methods with positional arguments `(resource, params)`. | - |
| `IDataProvider<TResource>` | `interface` | ARDOR data provider contract extending react-admin with `send`, `getNetworkService`, and `getDataSourceAuth`. | - |
| `IReactAdminAuthProvider` | `type` | Standard react-admin auth provider contract. | `login`, `logout`, `checkAuth`, `checkError`, `getIdentity`, `getPermissions`, `canAccess` |
| `IAuthProvider` | `interface` | ARDOR auth provider extending react-admin with `getRoles` and `refreshToken`. | - |
| `II18nProviderOptions` | `interface` | i18n configuration options, bound under `CoreBindings.I18N_PROVIDER_OPTIONS`. | `i18nSources`, `languages` |
| `TI18nSource` | `type` | The messages of one locale, loaded the first time the locale is used. | an object, or a loader `() => Promise<object>` |
| `IArdorApplicationProps` | `interface` | Props accepted by `<ArdorApplication>`, plus the `CoreAdmin` props. | `container`, `logger`, `reduxStore`, `suspense`, `accessDenied`, `resources`, `routes`, `features` |
| `TFeature` | `type` | Full admin feature specification extending `IFeatureBase` with resources, custom routes, and messages. | - |
| `TFeatureMessages` | `type` | Feature message dictionary or lazy message bundle loaders keyed by locale. | - |

## Related

- [Binding keys](binding-keys) - container binding keys and storage keys
- [Data provider](data-provider) - data provider contract and options
- [Auth provider](auth-provider) - auth provider contract and options
- [Hooks](hooks) - React hooks and context types
