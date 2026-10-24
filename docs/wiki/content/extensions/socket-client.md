---
title: Socket.IO client
description: ARDOR ships no socket client; a browser application uses the IGNIS SocketIOClientHelper, which is handed socket.io-client by the application.
---

# Socket.IO client

ARDOR does not carry a socket client. The IGNIS one, `SocketIOClientHelper` from `@venizia/ignis-helpers/socket-io/client`, has nothing node in its dependency graph, so a browser bundle can hold it. It does not import `socket.io-client` itself: the application imports `io` and hands it in as `module`.

## Prerequisites

`@venizia/ignis-helpers` and `socket.io-client` are installed in your application.

## Quick Reference

| Export | Kind | Purpose |
| --- | --- | --- |
| `SocketIOClientHelper` | class | Creates and manages one `Socket` for one host (`@venizia/ignis-helpers/socket-io/client`) |
| `useInjectable` | hook | Resolves the bound helper inside a React component |

## Using it

```ts no-check
import { SocketIOClientHelper } from '@venizia/ignis-helpers/socket-io/client';
import { io } from 'socket.io-client';

const socketHelper = new SocketIOClientHelper({
  identifier: 'notifications',
  host: 'https://api.example.com',
  options: { path: '/io', extraHeaders: { Authorization: 'Bearer <token>' } },
  module: { io },
  // ...onConnected, onDisconnected, onError, onAuthenticated, onUnauthenticated
});

socketHelper.subscribe({ event: 'order.created', handler: data => { /* ... */ } });
socketHelper.emit({ topic: 'order.ack', data: { id: 1 } });
```

The methods are `subscribe({ event, handler })`, `subscribeMany({ events })`, `unsubscribe({ event, handler? })`, `unsubscribeMany({ events })`, `emit({ topic, data })`, `connect()`, `disconnect()`, `getSocketClient()`, `joinRooms`, `leaveRooms` and `shutdown()`. A handler receives the payload (`handler(data)`), not the socket: call `getSocketClient()` for the socket. Its documentation is IGNIS's.

## From ARDOR's old helper

| ARDOR (removed) | IGNIS |
| --- | --- |
| `import ... from '@venizia/ardor/socket-io'` | `import ... from '@venizia/ignis-helpers/socket-io/client'` |
| `new SocketIOClientHelper({ identifier, host, options })` | the same, plus `module: { io }` from your own `import` |
| `subscribe({ events, ignoreDuplicate })`, handler `(client, ...args)` | `subscribeMany({ events })` or `subscribe({ event, handler })`, handler `(data)` |
| `unsubscribe({ events, handler? })` | `unsubscribe({ event, handler? })` or `unsubscribeMany({ events })` |
| `emit({ topic, message })` | `emit({ topic, data })` |

## Binding it

The helper is a plain class. Create one instance where you configure your application, bind it under a key you own, and resolve it with `useInjectable` where you need it; declare the key through `IUseInjectableKeysOverrides` (see [Module augmentation](../best-practices/module-augmentation)).

## Related

- [Network](../references/network) - the HTTP transport, which is IGNIS's too
- [Application](../references/application) - where services are bound
