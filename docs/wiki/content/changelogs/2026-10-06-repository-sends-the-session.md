---
title: A repository sends what the data provider sends
description: getDataSourceAuth() fills IGNIS 0.2.1-4's per-send hooks - session headers, timezone, channel, no token on no-auth paths, the server's error code.
---

# Changelog - 2026-10-06

## A repository sends what the data provider sends

<Badge type="warning" text="Behavior Change" />

**In one line.** An `HttpDataSource` spread with `getDataSourceAuth()` now sends what the data provider sends on every call: the session headers set with `setHeaders()`, the timezone, the request channel and tracing id, no token on a no-auth path, and a server error with its own code. It builds on IGNIS connectors `0.2.1-4`.

## What changed

Before, `getDataSourceAuth()` shared only the token and the 401 refresh. Headers were read once, when the datasource was built, so a merchant or locale switched later never reached a repository call. A sign-in route got the bearer token, and a `401` there started a refresh. A server error wrapped under `error` reached the app as `core.system_error`.

`getDataSourceAuth()` now returns four settings, and IGNIS runs the hooks on every send, the retry after a refresh included:

| Setting | What it does |
|---|---|
| `headersResolver` | The timezone, then whatever `setHeaders()` holds at send time. With the data provider's options, also `x-request-channel` and `x-request-id`. |
| `authTokenResolver` | The token, except on a path `isNoAuthPath` matches: `noAuthPaths`, `noAuthPathRegex`, or every path when `useAuth` is `false`. |
| `onUnauthorized` | Joins the shared refresh, except on a no-auth path or the refresh path itself, the same rule as the data provider. One call's abort never cancels the shared refresh. |
| `errorRootKey` | `'error'`, the key the data provider already unwraps. A repository error keeps the server's `statusCode`, `normalized.code` and `normalized.args`. |

The data provider gains its own `getDataSourceAuth()`, also on `IDataProvider`. It passes the provider's options and application info, so the channel and the tracing id come along:

```ts
import { CoreBindings, datasource, type IDataProvider, inject } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) dataProvider: IDataProvider,
  ) {
    super({ baseUrl: '/api', ...dataProvider.getDataSourceAuth() });
  }
}
```

`getNetworkService().getDataSourceAuth()` still works and sends everything except the channel and the tracing id.

- **IGNIS connectors `0.2.1-4`.** The peer floor moves from `>=0.2.1-3` to `>=0.2.1-4 <0.3.0`: on `0.2.1-3` the new settings would be ignored. `@venizia/ardor/repository` also re-exports what `0.2.1-4` adds: `HttpResponseReader`, `IHttpRequestContext`, `THttpHeadersResolver`, `IHttpCallOptions` (per-call `headers` and `signal` on every verb) and `THttpRepositoryOptions`. A `baseUrl` must now be absolute or start with `/`; anything else throws when the datasource is built.
- **A clearer error from `useInjectable({ key })`.** A key that is not bound now says why that happens in a minified build, and what to do: resolve by `{ target }`, or pin the key with `binding`. The message still starts with `Binding key: <key> is not bounded in context!`.

## Who is affected

- **Applications with an `HttpDataSource` spread with `getDataSourceAuth()`.** No code change is needed for the session headers, the no-auth rule or the error code. Switch to `dataProvider.getDataSourceAuth()` to also send the channel and the tracing id.
- **A repository that calls a no-auth route, or a service with `useAuth: false`.** It no longer sends the token there, as the data provider never did.
- **Code that implements `IDataProvider` by hand.** Add `getDataSourceAuth()`; a cast through `unknown` is not affected.
- **Code that called `getDataSourceAuth().authTokenResolver()` or `.onUnauthorized()` itself.** Both now take the request context, `{ paths }`.

> [!WARNING]
> A `@repository` whose constructor has no `@inject` at parameter 0 takes its datasource key from the datasource's class name, built when the class is decorated (IGNIS kernel `0.2.1-2`). When the datasource pins its key with `binding`, a minified build renames the class and the repository asks for a key nothing is bound under. Until IGNIS injects by class, write `@inject({ target: ApiDataSource })` on that parameter. See [Repositories](../references/repository#registering-a-repository).
