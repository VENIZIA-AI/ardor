import 'reflect-metadata';

import {
  BaseArdorApplication,
  CoreBindings,
  DefaultRestDataProvider,
  type IApplicationInfo,
  type IDataProvider,
  type ISendParams,
  type ISendResponse,
  RequestMethods,
} from '@venizia/ardor';

// --- the transport: what a desktop shell exposes instead of fetch (Tauri's `invoke`, a Worker
// port, an Electron bridge). One in-memory implementation is enough to show the seam.
type TCommand = (payload: ISendParams) => unknown;

const COMMANDS: Record<string, TCommand> = {
  products: (payload) => {
    const rows = [
      { id: 1, name: 'Espresso', price: 30000 },
      { id: 2, name: 'Latte', price: 45000 },
      { id: 3, name: 'Cold brew', price: 50000 },
    ];
    const id = payload.id;
    return id === undefined ? rows : rows.find((row) => row.id === Number(id));
  },
  'auth/login': (payload) => ({
    userId: 7,
    token: { value: `ipc-${String(payload.body?.username)}`, type: 'Bearer' },
  }),
};

const invoke = <TResponse>(opts: {
  command: string;
  payload: ISendParams;
}): Promise<ISendResponse<TResponse>> => {
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
  }): Promise<ISendResponse<TResponse>> {
    return invoke<TResponse>({ command: opts.resource, payload: opts.params });
  }
}

class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'ipc-example', version: '0.0.0', description: 'ARDOR over an IPC transport' };
  }

  bindContext(): void {
    // The base class still needs its options; the URL is never used by the IPC send.
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: 'ipc://local',
      useAuth: false,
    });
    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(IpcDataProvider);
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
  params: { method: RequestMethods.GET, id: 2 },
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
