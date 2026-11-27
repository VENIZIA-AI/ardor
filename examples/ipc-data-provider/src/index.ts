import 'reflect-metadata';

import { BindingScopes, getError } from '@venizia/ignis-inversion';

import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  DefaultRestDataProvider,
  type IApplicationInfo,
  type IDataProvider,
  type INetworkResponse,
  type IResponseSchema,
  NetworkResponseReader,
  type IRestDataProviderOptions,
  type ISendParams,
  provide,
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

const invoke = (opts: { command: string; payload: ISendParams }): Promise<INetworkResponse> => {
  const handler = COMMANDS[opts.command];

  if (!handler) {
    return Promise.reject({ message: `[ipc] unknown command ${opts.command}`, statusCode: 404 });
  }

  return Promise.resolve({ data: handler(opts.payload) });
};

// --- the schemas: `send` types the data a schema checked, and a zod schema would do the same.
interface IDrink {
  id: number;
  name: string;
}

const isDrink = (value: unknown): value is IDrink =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'number' &&
  'name' in value &&
  typeof value.name === 'string';

const isDrinkList = (value: unknown): value is IDrink[] =>
  Array.isArray(value) && value.every(isDrink);

const isSession = (value: unknown): value is { userId: number } =>
  typeof value === 'object' &&
  value !== null &&
  'userId' in value &&
  typeof value.userId === 'number';

const schemaOf = <TValue>(opts: {
  name: string;
  isValid: (value: unknown) => value is TValue;
}): IResponseSchema<TValue> => ({
  parse: (data) => {
    if (!opts.isValid(data)) {
      throw getError({ message: `[ipc] the answer is not a ${opts.name}` });
    }

    return data;
  },
});

// --- the provider: only `send` changes; the react-admin methods, the filter mapping and `value()`
// come from the base class. A shell with no HTTP at all overrides those too, in the same shape.
export class IpcDataProvider extends DefaultRestDataProvider {
  override send<TResult>(opts: {
    resource: string;
    params: ISendParams;
    schema: IResponseSchema<TResult>;
  }): Promise<INetworkResponse<TResult>>;
  /** As above with no schema: the data is unknown. */
  override send(opts: {
    resource: string;
    params: ISendParams;
    schema?: IResponseSchema;
  }): Promise<INetworkResponse>;
  override send(opts: {
    resource: string;
    params: ISendParams;
    schema?: IResponseSchema;
  }): Promise<INetworkResponse> {
    const { resource, params, schema } = opts;
    const answered = invoke({ command: resource, payload: params });

    if (!schema) {
      return answered;
    }

    return answered.then((response) => NetworkResponseReader.checkData({ response, schema }));
  }
}

// Discovered, never referenced by name: start() binds its @provide methods.
@configuration()
export class IpcConfiguration {
  // The base class still needs its options; the URL is never used by the IPC send.
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: 'ipc://local', noAuth: { regex: /./ } };
  }

  // No react-admin shell here: nothing signs in through an auth provider.
  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
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

const list = await dataProvider.send({
  resource: 'products',
  params: { method: RequestMethods.GET },
  schema: schemaOf({ name: 'drink list', isValid: isDrinkList }),
});
const one = await dataProvider.send({
  resource: 'products',
  params: { method: RequestMethods.GET, query: { id: 2 } },
  schema: schemaOf({ name: 'drink', isValid: isDrink }),
});
const login = await dataProvider.send({
  resource: 'auth/login',
  params: { method: RequestMethods.POST, body: { username: 'barista' } },
  schema: schemaOf({ name: 'session', isValid: isSession }),
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
