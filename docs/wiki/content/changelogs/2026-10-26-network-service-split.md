---
title: The network service is split into small parts, and its types are closed
description: DefaultNetworkRequestService stays the class you extend, but the token store, the body encoder, the response reader and the auth recovery live in their own files, and the request types lose their open index signatures.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-26

## The network service is split into small parts, and its types are closed

<Badge type="warning" text="Breaking Change" />

**In one line.** `DefaultNetworkRequestService` keeps its constructor and its protected hooks, but the code behind it is in separate files, and the request types no longer accept any key.

## What changed

- **One auth token store.** `AuthTokenStore.read()` and `AuthTokenStore.write()` are the one place that reads and writes the token under `LocalStorageKeys.KEY_AUTH_TOKEN`, with the `localStorage` guard and the rule that only the error name of a corrupt value is logged. `DefaultAuthService.getAuth()` and `saveAuth()` use it, and so does `DefaultNetworkRequestService.readAuthTokenFromStorage()`, which stays as a one-line delegate.
- **The token types are in `common/types.ts`.** `IAuthTokenRecord`, `IDataSourceRequestContext` and `IDataSourceAuth` moved there from the network service file. The package root exports them as before.
- **The body encoder is its own class.** `RequestBodyEncoder.encode({ bodyType, body })` returns the body and the content type to send (none for multipart, so `fetch` adds the boundary). `getRequestProps` keeps its signature and result and asks the new protected hook `encodeBody`, which delegates to it: override that to encode another way.

## Who is affected

- **A subclass of `DefaultNetworkRequestService`.** No action needed for this part: nothing it overrides changed.
- **A log reader.** A corrupt stored token is logged once, as a warning with scope `AuthTokenStore`, whichever reader meets it. `getAuth()` used to log an error under the scope `DefaultAuthService`, and also for an empty string; an empty string is now nothing stored.
- **Code that imports from the file path.** `IAuthTokenRecord` and the two data source types are no longer declared in `base/services/network-request`; import them from the package root.

## Breaking changes

> [!WARNING]
> This affects only a subclass of `DefaultNetworkRequestService` that overrides or calls the protected body helpers.

The protected methods `isFileList`, `encodeFormValue` and `appendFormDataValue` are gone from `DefaultNetworkRequestService`; their logic is private to `RequestBodyEncoder`. To change how a body is encoded, override `encodeBody({ bodyType, body })`, which returns `{ body, contentType? }`.

The rest of the breaking parts of this series are listed here as they land.
