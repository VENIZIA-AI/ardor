import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { BindingScopes, type Container, inject, type TClass } from '@venizia/ignis-inversion';
import { MetadataRegistry } from '@venizia/ignis-kernel/metadata';

import { BaseArdorApplication } from '@/applications';
import type { IDataProvider } from '@/common';
import { ApplicationProviders } from '@/components/resolve';
import { CountRestDataProvider } from '@/providers/count-rest-data';
import {
  configuration,
  CoreBindings,
  DefaultAuthService,
  type IApplicationInfo,
  provide,
  type TAuthProviderOptions,
} from '@venizia/ardor-kernel';

class Sources {
  static readonly PROVIDE = '@provide';
  static readonly OLD_PATTERN = 'instantiate().value()';
  static readonly LISTED = 'bindingList';
  static readonly CONTEXT = 'bindContext';
}

/** A data provider that says who built it, so a test can tell which binding won. */
const markedProvider = (opts: { source: string }) => {
  return class MarkedRestDataProvider extends CountRestDataProvider {
    override value(container: Container): IDataProvider {
      return Object.assign(super.value(container), { source: opts.source });
    }
  };
};

const sourceOf = (opts: { application: BaseArdorApplication }): unknown => {
  const dataProvider = opts.application.get<IDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });

  return Reflect.get(dataProvider, 'source');
};

interface ITestApplicationOptions {
  auth?: TAuthProviderOptions;
  listed?: Record<string, TClass<unknown>>;
  context?: (application: BaseArdorApplication) => void;
}

const createApplication = (opts: ITestApplicationOptions = {}) => {
  class MinimalApplication extends BaseArdorApplication {
    getAppInfo(): IApplicationInfo {
      return { name: 'minimal', version: '0.0.0', description: 'Only the REST options' };
    }

    override bindingList() {
      return opts.listed ?? {};
    }

    bindContext(): void {
      this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
        url: 'http://localhost/api',
      });

      if (opts.auth) {
        this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue(opts.auth);
      }

      opts.context?.(this);
    }
  }

  return new MinimalApplication();
};

const started = async (opts: ITestApplicationOptions = {}) => {
  const application = createApplication(opts);
  await application.start();

  return application;
};

describe('BaseArdorApplication binds the default providers', () => {
  test('with only the REST options bound it starts, and resolves data and i18n but no auth provider', async () => {
    const application = await started();
    const providers = ApplicationProviders.resolve({ container: application });

    expect(typeof providers.dataProvider.getList).toBe('function');
    expect(typeof providers.i18nProvider.translate).toBe('function');
    expect(providers.i18nProvider.getLocale()).toBe('en');
    expect(providers.authProvider).toBeUndefined();
    expect(Object.keys(providers).sort()).toEqual(['dataProvider', 'i18nProvider']);
  });

  test('{ use: true } resolves the auth provider and the auth service', async () => {
    const application = await started({ auth: { use: true } });
    const providers = ApplicationProviders.resolve({ container: application });

    expect(typeof providers.authProvider?.login).toBe('function');
    expect(
      application.get<DefaultAuthService>({ key: CoreBindings.DEFAULT_AUTH_SERVICE }),
    ).toBeInstanceOf(DefaultAuthService);
  });

  test('{ use: false } resolves no auth provider', async () => {
    const application = await started({ auth: { use: false } });

    expect(ApplicationProviders.resolve({ container: application }).authProvider).toBeUndefined();
  });

  test('each default is a singleton: two reads give one instance', async () => {
    const application = await started({ auth: { use: true } });

    for (const key of [
      CoreBindings.DEFAULT_REST_DATA_PROVIDER,
      CoreBindings.DEFAULT_I18N_PROVIDER,
      CoreBindings.DEFAULT_AUTH_PROVIDER,
      CoreBindings.DEFAULT_AUTH_SERVICE,
    ]) {
      expect(application.get({ key }), key).toBe(application.get({ key }));
    }
  });
});

describe('an application overrides a default', () => {
  // Decorating a class adds it to the process-wide discovery list: put the list back after each test.
  const registry = MetadataRegistry.getInstance();
  let discoveredBefore: ReadonlyArray<object> = [];

  beforeEach(() => {
    discoveredBefore = registry.getDiscoveredArtifacts();
  });

  afterEach(() => {
    registry.clearDiscoveredArtifacts();

    for (const target of discoveredBefore) {
      registry.addDiscoveredArtifact({ target });
    }
  });

  test('with one toProvider line in bindContext', async () => {
    const Marked = markedProvider({ source: Sources.CONTEXT });
    const application = await started({
      context: (app) => {
        app
          .bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
          .toProvider(Marked)
          .setScope(BindingScopes.SINGLETON);
      },
    });

    expect(sourceOf({ application })).toBe(Sources.CONTEXT);
  });

  test('with bindingList()', async () => {
    class ListedDataProvider {
      readonly source = Sources.LISTED;
    }
    const application = await started({
      listed: { [CoreBindings.DEFAULT_REST_DATA_PROVIDER]: ListedDataProvider },
    });

    expect(sourceOf({ application })).toBe(Sources.LISTED);
  });

  test('with a @provide method', async () => {
    @configuration()
    class DataConfiguration {
      @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      dataProvider() {
        return { source: Sources.PROVIDE };
      }
    }

    const application = await started();

    expect(DataConfiguration.name).toBe('DataConfiguration');
    expect(sourceOf({ application })).toBe(Sources.PROVIDE);
  });

  test('with the hand-wired instantiate().value() in a @provide method', async () => {
    const Marked = markedProvider({ source: Sources.OLD_PATTERN });

    @configuration()
    class HandWiredConfiguration {
      constructor(
        @inject({ key: CoreBindings.APPLICATION_INSTANCE })
        private readonly application: BaseArdorApplication,
      ) {}

      @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      dataProvider() {
        return this.application.instantiate(Marked).value(this.application);
      }
    }

    const application = await started();

    expect(HandWiredConfiguration.name).toBe('HandWiredConfiguration');
    expect(sourceOf({ application })).toBe(Sources.OLD_PATTERN);
  });

  test('bindContext() wins over bindingList() and @provide', async () => {
    const Marked = markedProvider({ source: Sources.CONTEXT });

    @configuration()
    class LosingConfiguration {
      @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      dataProvider() {
        return { source: Sources.PROVIDE };
      }
    }

    class ListedDataProvider {
      readonly source = Sources.LISTED;
    }

    const application = await started({
      listed: { [CoreBindings.DEFAULT_REST_DATA_PROVIDER]: ListedDataProvider },
      context: (app) => {
        app.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(Marked);
      },
    });

    expect(LosingConfiguration.name).toBe('LosingConfiguration');
    expect(sourceOf({ application })).toBe(Sources.CONTEXT);
  });
});

describe('BaseArdorApplication.start() validates the configuration', () => {
  const rejection = async (task: Promise<void>): Promise<string> => {
    try {
      await task;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }

    return expect.unreachable('Expected start() to reject');
  };

  class BareApplication extends BaseArdorApplication {
    getAppInfo(): IApplicationInfo {
      return { name: 'bare', version: '0.0.0', description: 'Binds nothing' };
    }

    bindContext(): void {}
  }

  test('an application with the REST options starts', async () => {
    const application = createApplication();

    await application.start();

    expect(application.isBound({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })).toBe(true);
  });

  test('an application with no REST options rejects at start, naming the key to bind', async () => {
    const message = await rejection(new BareApplication().start());

    expect(message).toContain(CoreBindings.REST_DATA_PROVIDER_OPTIONS);
    expect(message).toContain('Bind it');
  });

  test('auth options without the use toggle reject at start', async () => {
    const legacy = { paths: { signIn: '/auth/sign-in' } };
    const application = createApplication({
      context: (target) => target.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue(legacy),
    });

    const message = await rejection(application.start());

    expect(message).toContain('use: true');
  });
});
