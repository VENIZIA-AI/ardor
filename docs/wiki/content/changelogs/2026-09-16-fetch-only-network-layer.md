---
title: The network layer is fetch only, and axios is gone
description: ARDOR drops its axios transport and moves the socket client behind a sub-path, so importing the framework pulls no HTTP client and no optional peer.
---

# Changelog - 2026-09-16

## A fetch-only network layer

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="Enhancement" />

**In one line.** ARDOR no longer ships an axios transport, and the socket client now lives on its own import path, so `import '@venizia/ardor'` needs no HTTP client and no optional dependency installed.

## What changed

- **The axios transport is removed.** `AxiosNetworkRequest`, `AxiosFetcher`, `IAxiosRequestOptions` and `IAxiosNetworkOptions` no longer exist, and `axios` is not a peer dependency of any ARDOR package. `DefaultNetworkRequestService` already used `fetch`; now that is the only transport.
- **The socket client moved to a sub-path.** `SocketIOClientHelper` and `ISocketIOClientOptions` are imported from `@venizia/ardor/socket-io` (or `@venizia/ardor-kernel/socket-io`) instead of the package root.
- **Importing the framework installs nothing extra.** Both changes exist for the same reason: the root barrel used to pull `axios` and `socket.io-client` eagerly, so an application had to install two packages declared *optional* before it could import ARDOR at all.

## Who is affected

- **Applications that use the default data provider or network service.** No action needed - they were already on `fetch`.
- **Applications that imported `SocketIOClientHelper` from the package root.** Change the import path; the class itself is unchanged.
- **Applications that used `AxiosNetworkRequest` or `AxiosFetcher`.** Build the transport on `fetch`, or keep an axios helper in your own codebase.

## Breaking changes

> [!WARNING]
> Two public classes moved or disappeared. Both are transport-layer helpers; neither is used by the default data provider, auth provider or i18n provider.

**Before:**

```ts no-check
import { AxiosNetworkRequest, SocketIOClientHelper } from '@venizia/ardor';

// ...
const request = new AxiosNetworkRequest({ name: 'legacy', networkOptions: { baseUrl } });
const socket = new SocketIOClientHelper({ host, options });
```

**After:**

```ts
import { NodeFetchNetworkRequest } from '@venizia/ardor';
import { SocketIOClientHelper } from '@venizia/ardor/socket-io';

const request = new NodeFetchNetworkRequest({
  name: 'reporting',
  networkOptions: { baseUrl: 'https://api.example.com' },
});

const socket = new SocketIOClientHelper({
  identifier: 'reporting',
  host: 'https://api.example.com',
  options: { path: '/socket.io', extraHeaders: {} },
});
```

`socket.io-client` stays an optional peer, and is now genuinely optional: install it only if you import the `./socket-io` sub-path.

## Details

- `TFetcherVariant` is now `'node-fetch'` alone. `BaseNetworkRequest<T>` stays generic over it, so a consumer can still add a transport without forking the base.
- The browser-purity gate proves the result rather than asserting it: the kernel root entry bundles with no external dependency at all, while `kernel/socket-io` declares `socket.io-client` and is measured separately.

| File | Package |
|------|---------|
| `src/helpers/networks/fetchers/axios.ts` (deleted) | kernel |
| `src/helpers/networks/common/types.ts` | kernel |
| `src/helpers/networks/base-request.ts` | kernel |
| `package.json` exports and peers | kernel, ardor |
