---
title: Types
description: The public type vocabulary of ARDOR grouped by package, with each type described on one line alongside where it is used across kernel, react, and admin.
---

# Types

ARDOR organizes its public type vocabulary across three packages: `@venizia/ardor-kernel` (primitives, constants, network options, and repositories), `@venizia/ardor-react` (React context and hooks), and `@venizia/ardor-admin` (react-admin providers and application components). All symbols can be imported directly from `@venizia/ardor` (or `@venizia/ardor/repository` for repository classes and datasource settings).

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
| `NumberIdType` | `type` | Numeric entity identifier (`number`), used to narrow numeric entity ids. |
| `StringIdType` | `type` | String entity identifier (`string`), used to narrow string entity ids. |
| `NullableType` | `type` | Absent value union (`undefined \| null \| void`), used for empty or uninitialized states. |
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
| `TDataCount<T>` | `type` | Payload with optional total count (`{ data: T; count?: number }`). |

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

| Type | Kind | Definition and usage |
|---|---|---|
| `TRequestMethod` | `type` | HTTP methods union (`'HEAD' \| 'OPTIONS' \| 'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'`), used in network requests. |
| `TRequestType` | `type` | Operation types union (`RequestTypes`), used by data provider operations. |
| `TRequestBodyType` | `type` | Payload format union (`'none' \| 'form-data' \| 'x-www-form-urlencoded' \| 'json' \| 'binary'`), used in requests. |
| `TEnvironment` | `type` | Environment names union (`'development' \| 'production'`), used for runtime environment checks. |
| `IRequestProps` | `interface` | HTTP request options (`headers`, `body`, `query`), used by network fetchers. |
| `ISendParams` | `interface` | Parameters object for `dataProvider.send`, used for arbitrary endpoint calls. |
| `ISendResponse<T>` | `interface` | Envelope returned by `dataProvider.send` containing `{ data: T }`. |
| `IGetRequestPropsParams` | `interface` | Inputs to `getRequestProps`, used by `DefaultNetworkRequestService`. |
| `IGetRequestPropsResult` | `interface` | Output headers and body from `getRequestProps`, used by network request callers. |
| `ICustomParams` | `interface` | Parameter bag merged into react-admin calls via `params`. |
| `INoAuthOptions` | `interface` | Unauthenticated paths configuration (`noAuthPaths`, e.g. `['/auth/sign-in']`; `noAuthPathRegex`), used in network services. |
| `TNoAuthPathRegex` | `type` | Regex patterns (`string \| RegExp \| Array<string \| RegExp>`) matched against no-auth request paths. |
| `IAuthRecoveryOptions` | `interface` | Configuration for session refresh endpoint (`refreshTokenPath`, e.g. `'/auth/refresh'`), used in network auth recovery. |
| `IRestDataProviderOptions` | `interface` | Configuration options for REST data provider (URL, headers, channel, auth recovery, no-auth). |
| `ISignInSession` | `interface` | Session data extracted on login (`userId`, `token`, `roles`), used in sign-in lifecycle hooks. |
| `IAuthProviderOptions` | `interface` | Auth provider endpoint paths (`paths.signIn`, e.g. `'/auth/sign-in'`; `paths.checkAuth`; `paths.afterLogin`), bound under `CoreBindings.AUTH_PROVIDER_OPTIONS`. |
| `IAuthTokenRecord` | `interface` | Auth token payload (`value`, `type`, `provider`), returned by `resolveAuthToken()`. |
| `IDataSourceRequestContext` | `interface` | Request context (`paths`) supplied to `HttpDataSource` auth hooks. |
| `IDataSourceAuth` | `interface` | Bridge settings (`authTokenResolver`, `headersResolver`, `onUnauthorized`, `errorRootKey`) returned by `getDataSourceAuth()`. |
| `IApplicationInfo` | `interface` | Application metadata (`name`, `version`, `description`, `author`), bound under `CoreBindings.APPLICATION_INFO`. |
| `IFeatureBase` | `interface` | Base feature configuration (`name`, `configurations`, `permissions`), bound under `CoreBindings.FEATURES`. |
| `IArtifactIndex` | `interface` | Artifact registry index emitted by code generation and verified at application `start()`. |
| `IPermissionProvider` | `interface` | Authorization checker contract (`canAccess`), bound under `CoreBindings.PERMISSION_PROVIDER`. |
| `IArdorApplication` | `interface` | Application lifecycle contract implemented by `AbstractArdorApplication`. |

### Const classes

| Class | Kind | Definition and usage |
|---|---|---|
| `CoreBindings` | `class` | The eleven container keys for instances, options, providers, and features. |
| `LocalStorageKeys` | `class` | The three local storage keys for tokens, identities, and permissions. |
| `RequestMethods` | `class` | HTTP method constants (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) with `SCHEME_SET` and `isValid`. |
| `RequestTypes` | `class` | Data operation constants (`SEND`, `GET_LIST`, `GET_ONE`, etc.) with `SCHEME_SET` and `isValid`. |
| `RequestBodyTypes` | `class` | Request body formats (`JSON`, `FORM_DATA`, `BINARY`, etc.) with `SCHEME_SET` and `isValid`. |
| `Environments` | `class` | Environment constants (`DEVELOPMENT`, `PRODUCTION`) with `SCHEME_SET` and `isValid`. |
| `RequestCountData` | `class` | Count mode constants (`DATA_ONLY: '0'`, `DATA_WITH_COUNT: '1'`) with `SCHEME_SET` and `isValid`. |
| `RequestChannel` | `class` | Client channel constant (`WEB: '100_WEB'`) with `SCHEME_SET` and `isValid`. |
| `Authentication` | `class` | Auth types and strategies (`TYPE_BEARER`, `STRATEGY_JWT`) with `SCHEME_SET` and `isValid`. |
| `HeaderConstants` | `class` | HTTP header string constants read and written by network services. |
| `App` | `class` | Runtime defaults for `TIMEZONE`, `TIMEZONE_OFFSET`, `DEFAULT_LOCALE`, and `DEFAULT_DEBOUNCE_TIME`. |

### Repositories (@venizia/ardor/repository)

Source files: `packages/ardor/src/repository.ts` and `packages/kernel/src/base/repositories/index.ts`.

| Type | Kind | Definition and usage |
|---|---|---|
| `HttpDataSource` | `class` | Transport class managing HTTP requests for repositories. |
| `HttpRepository<E, P>` | `class` | Typed CRUD repository reading and writing a backend resource. |
| `IHttpDataSourceSettings` | `interface` | Constructor options for `HttpDataSource` (baseUrl, headers, auth token, resolvers, retry hook). |
| `IHttpReadResult<R>` | `interface` | Response from `HttpDataSource.read` containing rows, range flag, and count. |
| `IHttpWriteResult<R>` | `interface` | Response from `HttpDataSource.write` containing affected rows, count, and extras. |
| `IHttpCallOptions` | `interface` | Per-request options (`headers`, `signal`) accepted by repository calls. |
| `THttpRepositoryOptions` | `type` | Options accepted by `HttpRepository` methods combining call options and query flags. |
| `IAuthToken` | `interface` | Authentication token shape (`value`, `type`, `provider`) accepted by `HttpDataSource`. |
| `TAuthTokenResolver` | `type` | Hook function returning `IAuthToken \| undefined` for `HttpDataSource`. |
| `THttpHeaders` | `type` | Header inputs (`Headers \| Array<[string, string]> \| Record<string, string>`) accepted by `HttpDataSource`. |
| `THttpHeadersResolver` | `type` | Hook function returning dynamic `THttpHeaders` on each request. |
| `THttpBody` | `type` | Request body types (`string \| object`) accepted by `HttpDataSource`. |
| `TExtraRequest` | `type` | Request specification for list extras (`x-request-extra`). |
| `TExtraResult<T>` | `type` | Type extraction helper for list extras returned in `x-response-extra`. |
| `HttpExtraRequest` | `class` | Utility converting list extra definitions into `x-request-extra` header values. |

## @venizia/ardor-react

Source files: `packages/react/src/common/types.ts` and `packages/react/src/hooks/use-injectable.ts`.

| Type | Kind | Definition and usage |
|---|---|---|
| `ISyncFC<TProps>` | `interface` | Synchronous functional component interface returning `ReactNode`. |
| `IUseInjectableKeysOverrides` | `interface` | Augmentation interface for registering custom string keys with `useInjectable`. |
| `TUseInjectableKeysDefault` | `type` | Union of default string keys extracted from `CoreBindings`. |
| `TUseInjectableKeys` | `type` | Complete key union accepted by `useInjectable` (`TUseInjectableKeysDefault \| keyof IUseInjectableKeysOverrides`). |
| `TUseInjectableOptions` | `type` | Options discriminated union (`key` or `target`) accepted by `useInjectable`. |

## @venizia/ardor-admin

Source files: `packages/admin/src/common/types.ts` and `packages/admin/src/features/feature.ts`.

| Type | Kind | Definition and usage |
|---|---|---|
| `IReactAdminDataProvider<TResource>` | `interface` | Nine standard react-admin data methods with positional arguments `(resource, params)`. |
| `IDataProvider<TResource>` | `interface` | ARDOR data provider contract extending react-admin with `send`, `getNetworkService`, and `getDataSourceAuth`. |
| `IReactAdminAuthProvider` | `interface` | Standard react-admin auth provider contract (`login`, `logout`, `checkAuth`, `checkError`, `getIdentity`, `getPermissions`, `canAccess`). |
| `IAuthProvider` | `interface` | ARDOR auth provider extending react-admin with `getRoles` and `refreshToken`. |
| `II18nProviderOptions` | `interface` | i18n configuration options (`i18nSources`, `languages`), bound under `CoreBindings.I18N_PROVIDER_OPTIONS`. |
| `IApplication` | `interface` | Props accepted by `<ArdorApplication>` (`container`, `reduxStore`, `suspense`, `resources`, `routes`). |
| `TFeature` | `type` | Full admin feature specification extending `IFeatureBase` with resources, custom routes, and messages. |
| `TFeatureMessages` | `type` | Feature message dictionary or lazy message bundle loaders keyed by locale. |

## Related

- [Binding keys](binding-keys) - container binding keys and storage keys
- [Data provider](data-provider) - data provider contract and options
- [Auth provider](auth-provider) - auth provider contract and options
- [Hooks](hooks) - React hooks and context types
