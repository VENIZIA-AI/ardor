---
title: Options hold data, behaviour lives in protected hooks
description: Callbacks, flags and setters on the network service, providers and fetchers become protected hooks; an old-to-new table lists every renamed name.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin']
---

# Changelog - 2026-10-18

## Options hold data, behaviour lives in protected hooks

<Badge type="warning" text="Behavior Change" />

**In one line.** What was a callback, a flag or a setter in an options object is now a protected hook you override in a subclass, taking one `opts` object. A 401 refresh, for example, is no longer `authRecovery: { refreshToken }`:

```typescript
import {
  DefaultNetworkRequestService,
  DefaultRestDataProvider,
  LocalStorageKeys,
  RequestMethods,
  RequestTypes,
} from '@venizia/ardor';

class AppNetworkService extends DefaultNetworkRequestService {
  protected override async refreshToken(): Promise<boolean> {
    const { data } = await this.doRequest<{ token: string }>({
      type: RequestTypes.SEND,
      method: RequestMethods.POST,
      paths: ['/auth/token/refresh'],
      headers: this.getRequestHeader({ resource: '/auth/token/refresh' }),
    });

    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: data.token, type: 'Bearer' }),
    );
    return true;
  }
}

// The one place the data provider builds its network service. Bind the subclass under
// CoreBindings.DEFAULT_REST_DATA_PROVIDER.
class AppRestDataProvider extends DefaultRestDataProvider {
  protected override createNetworkService() {
    return new AppNetworkService({
      name: 'app-network-service',
      baseUrl: this.restDataProviderOptions.url,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      authRecovery: this.restDataProviderOptions.authRecovery, // { refreshTokenPath: '/auth/token/refresh' }
    });
  }
}
```

## What changed

- **Auth provider options are one URL group.** `IAuthProviderOptions` is `{ paths: { signIn, checkAuth, afterLogin } }`. `endpoints.afterLogin` moved to `paths.afterLogin`, and `paths.signUp`, which nothing read, is gone. The sign-in pages are protected getters (`signInPath`, `afterLoginPath`, `loginPagePath`, `unauthorizedPagePath`), and the helpers that read a sign-in response are protected methods (`readSignInSession`, `decodeJwtClaims`, `readRoleNames`).
- **`login` keeps its signature.** It is typed `(params) => Promise<unknown>`, as in 0.1.3 and 0.1.4-3, so a subclass that overrides `login` compiles. 0.1.4-4 had made it async with a narrower return type, which broke those subclasses with `TS2416`.
- **The 401 refresh is a hook of the network service.** `IAuthRecoveryOptions` keeps only `refreshTokenPath`. `refreshToken()` (resolve `true` after refreshing, `false` when there is nothing to refresh, throw on failure) and `onAuthFailure()` are protected hooks of `DefaultNetworkRequestService`. `refresh()` is public and shared: one call per burst of 401s, and also what `DefaultAuthProvider.refreshToken()` calls. `setAuthRecovery` and `getAuthRecovery` are gone.
- **`DefaultRestDataProvider.createNetworkService()`** builds the network service, once, on first use. Override it to return a subclass.
- **No-auth is data.** `noAuthPaths` and `noAuthPathRegex` are options, `isNoAuthPath` is a protected hook, and the `useAuth` flag and the three `set*` setters are gone. An API with no sign-in sets `noAuthPathRegex: /./`.
- **One way to supply a token.** Override `resolveAuthToken()` (now protected). `setAuthToken` and the `authTokenResolver` option are gone, and `readAuthTokenFromStorage` is the static `DefaultNetworkRequestService.readAuthTokenFromStorage()`.
- **The tracing id is a hook.** `buildRequestTracingId({ applicationInfo })` replaces the `requestTracingId` option. `requestTracingChannel` stays an option.
- **Headers.** `setHeaders({ headers })` and `removeHeaders({ keys })` take an object, and `NetworkHeaders.toRecord` / `NetworkHeaders.merge` replace two different `toHeaderRecord` functions. A per-call header on `send` now replaces a computed one whatever its case.
- **Lists.** `getList` and `getManyReference` share `buildListFilter({ params })`. `value()` keeps react-admin's positional `(resource, params)` signatures.
- **Fetchers.** `send(opts)` carries no logger, `getProtocol({ url })` takes an object, and the generics are `TRequest` and `TResponse`.
- **i18n.** The provider no longer reads `navigator` when the module is imported: `resolveInitialLocale({ locales })` and `composeMessages({ locale, messages })` are protected hooks, and nothing is read outside a browser.

### Migration table

| 0.1.4-4 | Now |
|---|---|
| `endpoints: { afterLogin }` | `paths: { afterLogin }` |
| `paths.signUp` | removed (never read) |
| `authRecovery: { refreshToken }` | `refreshToken()` hook on a `DefaultNetworkRequestService` subclass, returned by `createNetworkService()` |
| `authRecovery: { onAuthFailure }` | `onAuthFailure()` hook on the same subclass |
| `authRecovery: { refreshTokenPath }` | unchanged |
| `network.setAuthRecovery(...)`, `getAuthRecovery()` | removed |
| `authProvider.refreshToken()` resolved `undefined` | resolves `true` / `false` from the network service's `refresh()` |
| `useAuth: false` | `noAuthPathRegex: /./` |
| `network.setUseAuth`, `setNoAuthPaths`, `setNoAuthPathRegex` | removed |
| `network.isNoAuthPath(...)` (public) | protected hook |
| `requestTracingId` option | `buildRequestTracingId({ applicationInfo })` hook |
| `network.setAuthToken({ type, value })` | override `resolveAuthToken()` |
| `new DefaultNetworkRequestService({ authTokenResolver })` | override `resolveAuthToken()` |
| `readAuthTokenFromStorage` | `DefaultNetworkRequestService.readAuthTokenFromStorage()` (an `HttpDataSource` takes it as its `authTokenResolver`) |
| `network.resolveAuthToken()` (public) | protected hook |
| `network.setHeaders(headers)`, `removeHeaders(keys)` | `setHeaders({ headers })`, `removeHeaders({ keys })` |
| `fetcher.send(opts, logger)`, `getProtocol(url)` | `send(opts)`, `getProtocol({ url })` |
| `new NodeFetcher({ name, defaultConfigs, logger })` | `new NodeFetcher({ name, defaultConfigs })` |
| `login` typed by inference after 0.1.4-4 | `(params) => Promise<unknown>` again |
| the navigator read at import in `DefaultI18nProvider` | `resolveInitialLocale({ locales })` |

## Who is affected

- **An application on 0.1.4-4 that set `endpoints`, `useAuth`, `requestTracingId` or any `authRecovery` callback.** Use the table: the options become data or a subclass.
- **An application that calls `setAuthToken`, `setAuthRecovery`, `setUseAuth`, `setNoAuthPaths` or `setNoAuthPathRegex`.** Override the matching hook, or pass the data to the constructor.
- **An application that overrides `login`.** Nothing to change: the signature is the one from 0.1.3. Override the hooks (`buildSignInBody`, `resolveUsername`, `beforeSaveSession`, `saveSession`) instead where you can.
- **Everyone else.** No action needed.
