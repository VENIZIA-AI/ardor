---
title: Socket.IO client
description: Connect the IGNIS SocketIOClientHelper after sign-in, as the signed-in user, and drop it at sign-out, from a service and the auth provider's session hooks.
---

# Socket.IO client

ARDOR ships no socket client. A browser application uses the IGNIS one, `SocketIOClientHelper` from `@venizia/ignis-helpers/socket-io/client`, and hands it `socket.io-client`. Build the helper so that it connects only after sign-in, sends the token of the user signed in at that moment, and disconnects at sign-out:

```ts no-check
import { CoreBindings, DefaultAuthService, inject, service } from '@venizia/ardor';
import {
  type IOptions,
  SocketIOClientHelper,
  SocketIOClientStates,
  type TSocketIOEventHandler,
} from '@venizia/ignis-helpers/socket-io/client';
import * as SocketIOClient from 'socket.io-client';
import type { ManagerOptions } from 'socket.io-client';

@service()
export class NotificationSocketService {
  private readonly helper: SocketIOClientHelper;

  constructor(
    @inject({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
    private readonly authService: DefaultAuthService,
  ) {
    const options: IOptions & Partial<ManagerOptions> = {
      path: '/io',
      extraHeaders: {},
      autoConnect: false,
      // Read at every connect and reconnect, so the socket always carries the current token.
      auth: (callback) => callback({ token: this.authService.getAuth()?.value }),
    };

    this.helper = new SocketIOClientHelper({
      identifier: 'notifications',
      host: 'https://api.example.com',
      options,
      module: SocketIOClient,
      // The server drops a socket that does not authenticate in time, after every reconnect too.
      onConnected: () => this.helper.authenticate(),
      // ... onDisconnected, onError, onAuthenticated, onUnauthenticated as your screens need
    });
  }

  /** Connects again, so a new user or a new token is sent. */
  connect(): void {
    this.helper.disconnect();
    this.helper.connect();
  }

  disconnect(): void {
    this.helper.disconnect();
  }

  isAuthenticated(): boolean {
    return this.helper.getState() === SocketIOClientStates.AUTHENTICATED;
  }

  subscribe(opts: { event: string; handler: TSocketIOEventHandler }): void {
    this.helper.subscribe({ ...opts, ignoreDuplicate: false });
  }

  unsubscribe(opts: { event: string; handler: TSocketIOEventHandler }): void {
    this.helper.unsubscribe(opts);
  }
}
```

Notice three things:

- **`autoConnect: false`.** The helper calls `io()` in its constructor. Without this option the socket connects at boot, before anyone signs in.
- **`auth` is a function.** The helper keeps `options` for its whole life, so a token written into them is the token of the first user, on every reconnect. The function reads `authService.getAuth()` each time the socket connects.
- **`onConnected` authenticates.** The IGNIS server disconnects a client that does not emit `authenticate` within its `authenticateTimeout`, and the helper does not do it for you.

`socket.io-client` must be installed in your application, next to `@venizia/ignis-helpers`. Pass the whole module (`import * as SocketIOClient`): `module` is typed `typeof import('socket.io-client')`, so `module: { io }` does not compile.

## Connect at sign-in, disconnect at sign-out

The auth provider's session hooks fire when a session starts (sign-in, a refreshed token, a user switch) and when it ends. Override them to drive the socket, and bind your provider under `CoreBindings.DEFAULT_AUTH_PROVIDER` in place of the default one; the application still binds only the options:

```ts
import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  type IApplicationInfo,
  type IDataProvider,
  inject,
  type IRestDataProviderOptions,
  provide,
  type TAuthProviderOptions,
} from '@venizia/ardor';
import { BindingScopes } from '@venizia/ignis-inversion';

// The service of the first example.
declare class NotificationSocketService {
  connect(): void;
  disconnect(): void;
}

export class SocketAuthProvider extends DefaultAuthProvider {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    restDataProvider: IDataProvider,
    @inject({ key: CoreBindings.AUTH_PROVIDER_OPTIONS, isOptional: true })
    authProviderOptions: TAuthProviderOptions | undefined,
    @inject({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
    authService: DefaultAuthService,
    @inject({ target: NotificationSocketService })
    private readonly socket: NotificationSocketService,
  ) {
    super(restDataProvider, authProviderOptions, authService);
  }

  protected override onSessionStarted(): void {
    this.socket.connect();
  }

  protected override onSessionCleared(): void {
    this.socket.disconnect();
  }
}

@configuration()
export class ShopConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: '/api', noAuth: { paths: ['/auth/sign-in'] } };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return { use: true };
  }
}

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'The shop admin' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
      .toProvider(SocketAuthProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}
```

`onSessionStarted` reconnects on every new token too, so the socket never keeps an old one. The hooks also hear the other tabs of the application: a sign-in, a user switch or a sign-out there reconnects or disconnects the socket here. See [Session hooks](../references/auth-provider#session-hooks).

## Listen in a component

Resolve the service with `Ardor.useService({ target })` (the same function as the bare `useService`), subscribe in `useEffect` and unsubscribe in its clean-up, with the same handler. A payload comes from the network, so the handler takes `unknown` and checks its shape before it uses it:

```tsx
import { Ardor } from '@venizia/ardor';
import type { TSocketIOEventHandler } from '@venizia/ignis-helpers/socket-io/client';
import { useEffect, useState } from 'react';

// The service of the first example.
declare class NotificationSocketService {
  subscribe(opts: { event: string; handler: TSocketIOEventHandler }): void;
  unsubscribe(opts: { event: string; handler: TSocketIOEventHandler }): void;
}

interface IOrderCreated {
  id: string;
  total: number;
}

const isOrderCreated = (data: unknown): data is IOrderCreated => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof data.id === 'string' &&
    'total' in data &&
    typeof data.total === 'number'
  );
};

export const OrderFeed = () => {
  const socket = Ardor.useService({ target: NotificationSocketService });
  const [orders, setOrders] = useState<Array<IOrderCreated>>([]);

  useEffect(() => {
    const handler: TSocketIOEventHandler = (data) => {
      if (!isOrderCreated(data)) {
        return;
      }

      setOrders((previous) => [data, ...previous]);
    };

    socket.subscribe({ event: 'order.created', handler });

    return () => {
      socket.unsubscribe({ event: 'order.created', handler });
    };
  }, [socket]);

  return <p>{orders.length} new orders</p>;
};
```

## IGNIS limits

- **`emit` with a `callback` throws in a browser, after the event is sent.** The helper runs the callback through `setImmediate`, which browsers lack. Leave `callback` out, or call `getSocketClient().emit` yourself.
- **`subscribe` drops a second handler for an event by default.** With `ignoreDuplicate` left at `true`, a second component listening to the same event gets nothing. The service above passes `ignoreDuplicate: false`.
- **`extraHeaders` reach the server only over HTTP long-polling.** A browser cannot set headers on a WebSocket, so send the token in `auth`, as above.
- **`unsubscribe` takes a handler of `unknown`.** A handler typed for one payload cannot be passed back without a cast, so keep handlers on `unknown` and narrow inside them, as above.
- **`getState()`** answers `unauthorized`, `authenticating` or `authenticated` (`SocketIOClientStates`). The state returns to `unauthorized` on every disconnect.

The helper's other methods (`subscribeMany`, `unsubscribeMany`, `joinRooms`, `leaveRooms`, `getSocketClient`, `shutdown`) are documented by IGNIS.

## Related

- [Auth provider](../references/auth-provider) - the session hooks
- [Network](../references/network) - the HTTP transport, which is IGNIS's too
- [Application](../references/application) - where services are bound
