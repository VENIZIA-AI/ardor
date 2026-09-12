---
title: Socket.IO client helper
description: SocketIOClientHelper wraps a socket.io-client Socket with scoped logging, subscribe and unsubscribe by event map, guarded emit, and the lifecycle calls you need to bind it as a service.
---

# Socket.IO client helper

`SocketIOClientHelper` is a thin wrapper around a `socket.io-client` `Socket`. It creates the socket in its constructor, logs every subscription under a scoped `Logger`, and exposes `connect`, `disconnect`, `subscribe`, `unsubscribe`, `emit` and `getSocketClient`. It has no knowledge of react-admin or of the container - you bind an instance yourself and resolve it where you need it.

## Prerequisites

`socket.io-client` must be installed in your app - the helper imports `io` from it, and ARDOR does not pull it in for you.

## Quick Reference

| Export | Kind | Purpose |
| --- | --- | --- |
| `SocketIOClientHelper` | class | Creates and manages one `Socket` for one host |
| `ISocketIOClientOptions` | interface | Constructor options: `identifier`, `host`, `options` |
| `BaseHelper` | class | Parent class - gives the helper a `protected logger` scoped to `SocketIOClientHelper` |
| `useInjectable` | hook | Resolves the bound helper inside a React component |

## Options

The constructor takes one options object.

```ts no-check
interface ISocketIOClientOptions {
  identifier: string;   // label used in every log line
  host: string;         // first argument to io()
  options: {
    path: string;       // socket.io path on the server
    extraHeaders: Record<string | symbol | number, AnyType>;
    // ...plus any socket.io-client SocketOptions
  };
}
```

`identifier` is only used for logging. `host` and `options` are passed straight to `io(host, options)`. Both `path` and `extraHeaders` are required by the type - pass an empty object for `extraHeaders` if you have no headers to add.

```ts
import { SocketIOClientHelper, type ISocketIOClientOptions } from '@venizia/ardor';

const opts: ISocketIOClientOptions = {
  identifier: 'notifications',
  host: 'https://api.example.com',
  options: {
    path: '/io',
    extraHeaders: { Authorization: 'Bearer <token>' },
  },
};

const socketHelper = new SocketIOClientHelper(opts);
```

## configure, connect, disconnect

`configure()` is called by the constructor. It creates the `Socket` with `io(host, options)` and stores it. Calling `configure()` again is a no-op - the helper logs that the client is already established and returns. There is no way to swap the host or options on an existing instance; create a new helper instead.

```ts no-check
declare class SocketIOClientHelper {
  configure(): void;
  connect(): void;
  disconnect(): void;
}
```

`connect()` calls `client.connect()`. `disconnect()` calls `client.disconnect()`. Both log and return early if the client does not exist, which cannot happen after the constructor has run.

```ts
import { SocketIOClientHelper } from '@venizia/ardor';

const socketHelper = new SocketIOClientHelper({
  identifier: 'notifications',
  host: 'https://api.example.com',
  options: { path: '/io', extraHeaders: {} },
});

socketHelper.connect();

// later, for example on logout
socketHelper.disconnect();
```

## subscribe and unsubscribe

`subscribe` takes a map of event name to handler. For each entry the helper calls `client.on(eventName, ...)`. Entries with no handler are skipped and logged. With `ignoreDuplicate: true`, an event that already has listeners (`client.hasListeners(eventName)`) is skipped and logged instead of getting a second listener.

```ts no-check
declare class SocketIOClientHelper {
  subscribe(opts: {
    events: Record<string, (...props: AnyType) => void>;
    ignoreDuplicate?: boolean; // default false
  }): void;

  unsubscribe(opts: { events: Array<string> }): void;
}
```

The handler is not called with the raw event arguments alone. The helper prepends the `Socket` instance: `handler(client, ...eventArgs)`. So the first parameter of your handler is the socket, and the payload starts at the second.

`unsubscribe` calls `client.off(eventName)` for every name that currently has listeners. `off` with only an event name removes all listeners for that event, including any you added through `getSocketClient()`.

```ts
import { SocketIOClientHelper } from '@venizia/ardor';

const socketHelper = new SocketIOClientHelper({
  identifier: 'notifications',
  host: 'https://api.example.com',
  options: { path: '/io', extraHeaders: {} },
});

socketHelper.subscribe({
  ignoreDuplicate: true,
  events: {
    'order:created': (client, payload) => {
      console.log('connected as', client.id, 'received', payload);
    },
    'order:cancelled': (_client, payload) => {
      console.log('cancelled', payload);
    },
  },
});

// remove both listeners
socketHelper.unsubscribe({ events: ['order:created', 'order:cancelled'] });
```

## emit

`emit` sends one message on one topic. It throws before sending if the client is not connected.

```ts no-check
declare class SocketIOClientHelper {
  emit(opts: { topic: string; message: string; doLog?: boolean }): void;
}
```

- If `client.connected` is false, the helper throws an error with `statusCode: 400` and message `[emit] Invalid socket client state to emit!`.
- `message` is typed as `string`. Serialize objects yourself before passing them.
- `doLog` defaults to `false`. When `true`, the helper logs the topic and message after emitting.

```ts
import { SocketIOClientHelper } from '@venizia/ardor';

const socketHelper = new SocketIOClientHelper({
  identifier: 'notifications',
  host: 'https://api.example.com',
  options: { path: '/io', extraHeaders: {} },
});

socketHelper.connect();

try {
  socketHelper.emit({
    topic: 'room:join',
    message: JSON.stringify({ room: 'orders' }),
    doLog: true,
  });
} catch (error) {
  // thrown when the socket is not connected yet
  console.error(error);
}
```

## getSocketClient

Returns the underlying `Socket`. Use it for anything the helper does not wrap, such as `client.connected`, `client.id`, `once`, or acknowledgements.

```ts no-check
declare class SocketIOClientHelper {
  getSocketClient(): Socket;
}
```

```ts
import { SocketIOClientHelper } from '@venizia/ardor';

const socketHelper = new SocketIOClientHelper({
  identifier: 'notifications',
  host: 'https://api.example.com',
  options: { path: '/io', extraHeaders: {} },
});

const client = socketHelper.getSocketClient();
client.once('connect', () => {
  console.log('socket id', client.id);
});
```

Listeners you attach directly count for `hasListeners`, so a later `subscribe({ ignoreDuplicate: true })` on the same event will skip that event.

## Binding it as a service

The helper is a plain class with no container decorators. Create one instance where you configure your application, bind it under a key of your own, and resolve it in components with `useInjectable`. The binding API and the hook signature are documented on their own pages - see [Services](../best-practices/services) and [Hooks](../references/hooks). The component below assumes the helper was bound under `services.SocketIOClientHelper`.

```tsx
import { useEffect } from 'react';
import { SocketIOClientHelper, useInjectable } from '@venizia/ardor';

// The key you bound the helper under, made known to `useInjectable`.
declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides {
    'services.SocketIOClientHelper': unknown;
  }
}

export const OrderFeed = () => {
  const socketHelper = useInjectable<SocketIOClientHelper>({ key: 'services.SocketIOClientHelper' });

  useEffect(() => {
    socketHelper.subscribe({
      ignoreDuplicate: true,
      events: {
        'order:created': (_client: unknown, payload: unknown) => {
          console.info('[OrderFeed] order created', payload);
        },
      },
    });

    return () => {
      socketHelper.unsubscribe({ events: ['order:created'] });
    };
  }, [socketHelper]);

  return <p>Listening for orders</p>;
};
```

Keep one instance per host. Because `configure()` refuses to rebuild an existing client, a single bound instance is the natural way to share one socket across the app.

## Common pitfalls

- **Handler arguments are shifted.** The first argument passed to every handler is the `Socket`. Payload starts at the second argument.
- **`emit` throws when not connected.** Check `getSocketClient().connected` or wait for the `connect` event before emitting. There is no queue.
- **`message` must be a string.** The type is `string`, not an object. `JSON.stringify` first.
- **`path` and `extraHeaders` are required.** Both fields are non-optional on the options type. Pass `extraHeaders: {}` when you have none.
- **`unsubscribe` removes every listener for the event.** It calls `client.off(eventName)` without a handler reference. Listeners you added through `getSocketClient()` go too.
- **`ignoreDuplicate` defaults to `false`.** Calling `subscribe` twice with the same events without it adds a second listener each time. Set it to `true` inside React effects, or unsubscribe on cleanup.
- **Options are fixed after construction.** `configure()` is a no-op once a client exists. To change host, path or headers, create a new helper.

## Related

- [Services](../best-practices/services) - how to bind and scope a service instance
- [Hooks](../references/hooks) - `useInjectable` and the other React hooks
- [Binding keys](../references/binding-keys) - the key conventions used in the container
- [Network](../references/network) - HTTP request helpers that share the same `Logger`
- [Custom transport](./custom-transport) - replacing the HTTP fetcher rather than adding a socket
- [Application](../references/application) - where the application wires its providers and services
