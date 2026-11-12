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

export const loadUser = (id: IdType): ValueOrPromise<UserItem> => {
  return { id, title: 'Sample' };
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
| `AnyType` | `type` | Named alias for `any`, used at untyped boundaries and generic defaults. |
| `AnyObject` | `type` | Loose record (`Record<string \| symbol \| number, any>`), used for untyped property dictionaries. |
| `ValueOrPromise<T>` | `type` | Sync or async value (`T \| Promise<T>`), used in application lifecycle methods (`preConfigure`, `start`). |
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
| `TRequestMethod` | `type` | HTTP methods union, used in network requests. | `'HEAD' \| 'OPTIONS' \| 'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'` |
| `TRequestType` | `type` | Operation types union (`RequestTypes`), used by data provider operations. | - |
| `TRequestBodyType` | `type` | Payload format union, used in requests. | `'none' \| 'form-data' \| 'x-www-form-urlencoded' \| 'json' \| 'binary'` |
| `TEnvironment` | `type` | Environment names union, used for runtime environment checks. | `'development' \| 'production'` |
| `ISendParams` | `interface` | Parameters object for `dataProvider.send`, used for arbitrary endpoint calls. | `method`, `requestType`, `bodyType`, `body`, `query`, `headers`, `requestCountData`, `extra` |
| `INetworkResponse<T>` | `interface` | Envelope returned by `dataProvider.send` and the network service. | `data`, and `total`, `count`, `filename`, `contentDisposition`, `extra` where the response has them |
| `IGetRequestPropsParams` | `interface` | Inputs to `getRequestProps`, used by `DefaultNetworkRequestService`. | - |
| `IGetRequestPropsResult` | `interface` | Output headers and body from `getRequestProps`, used by network request callers. | - |
| `ICustomParams` | `interface` | Parameter bag merged into react-admin calls via `params`. | - |
| `INoAuthOptions` | `interface` | Unauthenticated paths configuration, used in network services. | `noAuthPaths`, e.g. `['/auth/sign-in']`; `noAuthPathRegex` |
| `TNoAuthPathRegex` | `type` | Regex patterns matched against no-auth request paths. | `string \| RegExp \| Array<string \| RegExp>` |
| `IAuthRecoveryOptions` | `interface` | Configuration for session refresh endpoint, used in network auth recovery. | `refreshTokenPath`, e.g. `'/auth/refresh'` |
| `IRestDataProviderOptions` | `interface` | Configuration options for REST data provider (URL, headers, channel, auth recovery, no-auth). | - |
| `ISignInSession` | `interface` | Session data extracted on login, used in sign-in lifecycle hooks. | `userId`, `token`, `roles` |
| `IAuthProviderOptions` | `interface` | Auth provider endpoint paths, bound under `CoreBindings.AUTH_PROVIDER_OPTIONS`. | `paths.signIn`, e.g. `'/auth/sign-in'`; `paths.checkAuth`; `paths.afterLogin` |
| `IAuthTokenRecord` | `interface` | Auth token payload, returned by `resolveAuthToken()`. | `value`, `type`, `provider` |
| `IDataSourceRequestContext` | `interface` | Request context supplied to `HttpDataSource` auth hooks. | `paths` |
| `IDataSourceAuth` | `interface` | Bridge settings returned by `getDataSourceAuth()`. | `authTokenResolver`, `headersResolver`, `onUnauthorized`, `errorRootKey` |
| `IApplicationInfo` | `interface` | Application metadata, bound under `CoreBindings.APPLICATION_INFO`. | `name`, `version`, `description`, `id`, `author`; no other key |
| `IFeatureBase` | `interface` | Base feature configuration, bound under `CoreBindings.FEATURES`. | `name`, `configurations`, `permissions` |
| `IArtifactIndex` | `interface` | Artifact registry index emitted by code generation and verified at application `start()`. | - |
| `IPermissionProvider` | `interface` | Authorization checker contract, bound under `CoreBindings.PERMISSION_PROVIDER`. | `canAccess` |
| `IArdorApplication` | `interface` | Application lifecycle contract implemented by `AbstractArdorApplication`. | - |

`ISendParams` names every field it accepts: a typo is a compile error.

### Const classes

| Class | Kind | Definition and usage | Shape |
|---|---|---|---|
| `CoreBindings` | `class` | The eleven container keys for instances, options, providers, and features. | - |
| `LocalStorageKeys` | `class` | The local storage keys for tokens, identities, and permissions, and the two prefixes. | `KEY_AUTH_*`, `PREFIX_AUTH`, `PREFIX_STORE` |
| `RequestMethods` | `class` | HTTP method constants, with `SCHEME_SET` and `isValid`. | `HEAD`, `OPTIONS`, `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `RequestTypes` | `class` | Data operation constants with `SCHEME_SET` and `isValid`. | `SEND`, and the nine react-admin verbs from `GET_LIST` to `DELETE_MANY` |
| `RequestBodyTypes` | `class` | Request body formats with `SCHEME_SET` and `isValid`. | `NONE`, `FORM_DATA`, `FORM_URL_ENCODED`, `JSON`, `BINARY` |
| `Environments` | `class` | Environment constants with `SCHEME_SET` and `isValid`. | `DEVELOPMENT`, `PRODUCTION` |
| `RequestCountData` | `class` | Count mode constants with `SCHEME_SET` and `isValid`. | `DATA_ONLY: '0'`, `DATA_WITH_COUNT: '1'` |
| `RequestChannel` | `class` | Client channel constant with `SCHEME_SET` and `isValid`. | `WEB: '100_WEB'` |
| `Authentication` | `class` | Auth types and strategies with `SCHEME_SET` and `isValid`. | `TYPE_BEARER`, `STRATEGY_JWT` |
| `HeaderConstants` | `class` | HTTP header string constants read and written by network services. | - |
| `App` | `class` | Runtime defaults. The i18n provider defaults to `en`. | `TIMEZONE`, `TIMEZONE_OFFSET`, `DEFAULT_DEBOUNCE_TIME` |

### Repositories (@venizia/ardor/repository)

Source files: `packages/ardor/src/repository.ts` and `packages/kernel/src/base/repositories/index.ts`.

| Type | Kind | Definition and usage | Shape |
|---|---|---|---|
| `HttpDataSource` | `class` | Transport class managing HTTP requests for repositories. | - |
| `HttpRepository<E, P>` | `class` | Typed CRUD repository reading and writing a backend resource. | - |
| `IHttpDataSourceSettings` | `interface` | Constructor options for `HttpDataSource`. | `baseUrl`, headers, auth token, resolvers, retry hook |
| `IHttpReadResult<R>` | `interface` | Response from `HttpDataSource.read` containing rows, range flag, and count. | - |
| `IHttpWriteResult<R>` | `interface` | Response from `HttpDataSource.write` containing affected rows, count, and extras. | - |
| `IHttpCallOptions` | `interface` | Per-request options accepted by repository calls. | `headers`, `signal` |
| `THttpRepositoryOptions` | `type` | Options accepted by `HttpRepository` methods combining call options and query flags. | - |
| `IAuthToken` | `interface` | Authentication token shape accepted by `HttpDataSource`. | `value`, `type`, `provider` |
| `TAuthTokenResolver` | `type` | Hook function returning `IAuthToken \| undefined` for `HttpDataSource`. | - |
| `THttpHeaders` | `type` | Header inputs accepted by `HttpDataSource`. | `Headers \| Array<[string, string]> \| Record<string, string>` |
| `THttpHeadersResolver` | `type` | Hook function returning dynamic `THttpHeaders` on each request. | - |
| `THttpBody` | `type` | Request body types accepted by `HttpDataSource`. | `string \| object` |
| `TExtraRequest` | `type` | Request specification for list extras (`x-request-extra`). | - |
| `TExtraResult<T>` | `type` | Type extraction helper for list extras returned in `x-response-extra`. | - |
| `HttpExtraRequest` | `class` | Utility converting list extra definitions into `x-request-extra` header values. | - |

## @venizia/ardor-react

Source file: `packages/react/src/hooks/use-injectable.ts`.

| Type | Kind | Definition and usage | Shape |
|---|---|---|---|
| `IUseInjectableKeysOverrides` | `interface` | Augmentation interface for registering custom string keys with `useInjectable`. | - |
| `TUseInjectableKeysDefault` | `type` | Union of default string keys extracted from `CoreBindings`. | - |
| `TUseInjectableKeys` | `type` | Complete key union accepted by `useInjectable`. | `TUseInjectableKeysDefault \| keyof IUseInjectableKeysOverrides` |
| `TUseInjectableOptions` | `type` | Options discriminated union (`key` or `target`) accepted by `useInjectable`. | - |

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
| `IApplication` | `interface` | Props accepted by `<ArdorApplication>`, plus the `CoreAdmin` props. | `container`, `logger`, `reduxStore`, `suspense`, `resources`, `routes`, `features` |
| `TFeature` | `type` | Full admin feature specification extending `IFeatureBase` with resources, custom routes, and messages. | - |
| `TFeatureMessages` | `type` | Feature message dictionary or lazy message bundle loaders keyed by locale. | - |

## Related

- [Binding keys](binding-keys) - container binding keys and storage keys
- [Data provider](data-provider) - data provider contract and options
- [Auth provider](auth-provider) - auth provider contract and options
- [Hooks](hooks) - React hooks and context types
