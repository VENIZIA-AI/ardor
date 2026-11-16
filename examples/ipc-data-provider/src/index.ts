import 'reflect-metadata';

import { BindingScopes } from '@venizia/ignis-inversion';

import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  DefaultRestDataProvider,
  type IApplicationInfo,
  type IDataProvider,
  type INetworkResponse,
  type IRestDataProviderOptions,
  type ISendParams,
  provideOption,
  RequestMethods,
  type TAuthProviderOptions,
} from '@venizia/ardor';

// --- the transport: what a desktop shell exposes instead of fetch (Tauri's `invoke`, a Worker
// port, an Electron bridge). One in-memory implementation is enough to show the seam.
type TCommand = (payload: ISendParams) => unknown;

// `ISendParams.body` is `unknown`: read the one field this command needs.
const usernameOf = (body: unknown): string =>
  typeof body === 'object' && body !== null && 'username' in body ? String(body.username) : '';

const COMMANDS: Record<string, TCommand> = {
  products: (payload) => {
    const rows = [
      { id: 1, name: 'Espresso', price: 30000 },
      { id: 2, name: 'Latte', price: 45000 },
      { id: 3, name: 'Cold brew', price: 50000 },
    ];
    const id = payload.query?.id;
    return id === undefined ? rows : rows.find((row) => row.id === Number(id));
  },
  'auth/login': (payload) => ({
    userId: 7,
    token: { value: `ipc-${usernameOf(payload.body)}`, type: 'Bearer' },
  }),
};

const invoke = <TResponse>(opts: {
  command: string;
  payload: ISendParams;
}): Promise<INetworkResponse<TResponse>> => {
  const handler = COMMANDS[opts.command];
  if (!handler) {
    return Promise.reject({ message: `[ipc] unknown command ${opts.command}`, statusCode: 404 });
  }
  return Promise.resolve({ data: handler(opts.payload) as TResponse });
};

// --- the provider: only `send` changes; the react-admin methods, the filter mapping and `value()`
// come from the base class. A shell with no HTTP at all overrides those too, in the same shape.
export class IpcDataProvider extends DefaultRestDataProvider {
  override send<TResponse = unknown>(opts: {
    resource: string;
    params: ISendParams;
  }): Promise<INetworkResponse<TResponse>> {
    return invoke<TResponse>({ command: opts.resource, payload: opts.params });
  }
}

// Discovered, never referenced by name: start() binds its @provideOption methods.
@configuration()
export class IpcConfiguration {
  // The base class still needs its options; the URL is never used by the IPC send.
  @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: 'ipc://local', noAuthPathRegex: /./ };
  }

  // No react-admin shell here: nothing signs in through an auth provider.
  @provideOption({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return { use: false };
  }
}

class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'ipc-example', version: '0.0.0', description: 'ARDOR over an IPC transport' };
  }

  // The one line that replaces the default data provider with the IPC one.
  bindContext(): void {
    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      .toProvider(IpcDataProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}

const application = new Application();
await application.start();

const dataProvider = application.get<IDataProvider>({
  key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
});

const list = await dataProvider.send<{ id: number; name: string }[]>({
  resource: 'products',
  params: { method: RequestMethods.GET },
});
const one = await dataProvider.send<{ id: number; name: string }>({
  resource: 'products',
  params: { method: RequestMethods.GET, query: { id: 2 } },
});
const login = await dataProvider.send<{ userId: number }>({
  resource: 'auth/login',
  params: { method: RequestMethods.POST, body: { username: 'barista' } },
});

console.log(
  `[ipc] ${list.data.length} products over IPC; product #2 is ${one.data.name}; login -> userId ${login.data.userId}`,
);

try {
  await dataProvider.send({ resource: 'nope', params: { method: RequestMethods.GET } });
} catch (error) {
  console.log(`[ipc] unknown command rejected as expected: ${JSON.stringify(error)}`);
}

if (list.data.length !== 3 || one.data.name !== 'Latte' || login.data.userId !== 7) {
  console.error('[ipc] FAILED - unexpected data');
  process.exit(1);
}
console.log('[ipc] OK');
