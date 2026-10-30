---
title: The network layer is fetch only, and axios is gone
description: ARDOR drops its axios transport and moves the socket client behind a sub-path, so importing the framework pulls no HTTP client and no optional peer.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-09-16

## A fetch-only network layer

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="Enhancement" />

**In one line.** ARDOR no longer ships an axios transport, and the socket client now lives on its own import path, so `import '@venizia/ardor'` needs no HTTP client and no optional dependency installed.

## What changed

- **The axios transport is removed.** `AxiosNetworkRequest`, `AxiosFetcher`, `IAxiosRequestOptions` and `IAxiosNetworkOptions` no longer exist, and `axios` is not a peer dependency of any ARDOR package. `fetch` is the only transport.
- **The socket client moved to a sub-path.** Import `SocketIOClientHelper` and `ISocketIOClientOptions` from `@venizia/ardor/socket-io` (or `@venizia/ardor-kernel/socket-io`) instead of the package root.
- **Nothing extra to install.** The root import used to pull `axios` and `socket.io-client`, so an application had to install two packages declared optional before it could import ARDOR at all.
- **`TFetcherVariant` is now `'node-fetch'` alone.** `BaseNetworkRequest<T>` stays generic over it, so you can still add your own transport.

## Who is affected

- **Applications that use the default data provider or network service.** No action needed - they were already on `fetch`.
- **Applications that imported `SocketIOClientHelper` from the package root.** Change the import path; the class itself is unchanged.
- **Applications that used `AxiosNetworkRequest` or `AxiosFetcher`.** Build the transport on `fetch`, or keep an axios helper in your own codebase.

## Breaking changes

> [!WARNING]
> Two public classes moved or disappeared. Neither is used by the default data provider, auth provider or i18n provider.

**Before:**

```ts no-check
import { AxiosNetworkRequest, SocketIOClientHelper } from '@venizia/ardor';

// ...
const request = new AxiosNetworkRequest({ name: 'legacy', networkOptions: { baseUrl } });
const socket = new SocketIOClientHelper({ host, options });
```

**After:**

```ts no-check
// Written for 0.3.x; both classes are IGNIS's since 2026-10-25.
import { NodeFetchNetworkRequest } from '@venizia/ardor';
import { SocketIOClientHelper } from '@venizia/ardor/socket-io';
// ...

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
