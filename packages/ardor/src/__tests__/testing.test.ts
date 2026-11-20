import 'reflect-metadata';

import { afterEach, describe, expect, test } from 'bun:test';

import { BaseArdorApplication, DefaultI18nProvider, Features } from '@venizia/ardor-admin';
import {
  AbstractArdorApplication,
  CoreBindings,
  inject,
  type IApplicationInfo,
} from '@venizia/ardor-kernel';
import { BindingKeys, Container, getError } from '@venizia/ignis-inversion';
import * as Kernel from '@venizia/ardor-kernel/testing';
import * as Testing from '@/testing';
import { assertArdorApplicationBoots } from '@/testing';

class Dependency {}

class Orders {
  constructor(
    @inject({ key: BindingKeys.build<unknown>({ key: 'services.Dependency' }) })
    readonly dependency: Dependency,
  ) {}
}

class Detached {
  constructor(
    @inject({ key: BindingKeys.build<unknown>({ key: 'services.Missing' }) })
    readonly missing: unknown,
  ) {}
}

const authProvider = {};
const dataProvider = {};
const i18nProvider = { getLocale: () => 'en', changeLocale: () => Promise.resolve() };

interface IFixtureOptions {
  services?: Array<[string, new (...args: never[]) => unknown]>;
  withoutDataProvider?: boolean;
  withAuthProvider?: boolean;
  withBrokenAuthProvider?: boolean;
  features?: ReturnType<typeof Features.define>[];
  i18n?: object;
  i18nOptions?: object;
}

const createApplication = (opts: IFixtureOptions = {}) => {
  const {
    services = [],
    withoutDataProvider = false,
    withAuthProvider = false,
    withBrokenAuthProvider = false,
    features,
    i18n = i18nProvider,
    i18nOptions,
  } = opts;

  class FixtureApplication extends AbstractArdorApplication {
    getAppInfo(): IApplicationInfo {
      return { name: 'fixture', version: '0.0.0', description: 'A fixture' };
    }

    bindContext(): void {
      if (!withoutDataProvider) {
        this.bind({
          key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }),
        }).toValue(dataProvider);
      }

      this.bind({
        key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_I18N_PROVIDER }),
      }).toValue(i18n);

      if (i18nOptions) {
        this.bind({
          key: BindingKeys.build<unknown>({ key: CoreBindings.I18N_PROVIDER_OPTIONS }),
        }).toValue(i18nOptions);
      }

      if (withAuthProvider || withBrokenAuthProvider) {
        this.bind({
          key: BindingKeys.build<unknown>({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }),
        }).toValue({ use: true });
      }

      if (withAuthProvider) {
        this.bind({
          key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }),
        }).toValue(authProvider);
      }

      if (withBrokenAuthProvider) {
        this.bind({
          key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }),
        }).toClass(Detached);
      }

      if (features) {
        this.bind({ key: BindingKeys.build<unknown>({ key: CoreBindings.FEATURES }) }).toValue(
          features,
        );
      }

      for (const [key, target] of services) {
        this.bind({ key: BindingKeys.build<unknown>({ key }) }).toClass(target);
      }
    }
  }

  return new FixtureApplication();
};

const messageOf = async (task: Promise<unknown>): Promise<string> => {
  try {
    await task;
  } catch (error) {
    return (error as Error).message;
  }

  throw getError({ message: 'Expected the task to reject' });
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('assertArdorApplicationBoots', () => {
  test('resolves with the same application when everything resolves', async () => {
    const application = createApplication({
      services: [
        ['services.Dependency', Dependency],
        ['services.Orders', Orders],
      ],
    });

    const result = await assertArdorApplicationBoots(application);
    expect(result).toBe(application);
  });

  test('rejects when a service injects a key nobody bound, naming the key and who needs it', async () => {
    const application = createApplication({ services: [['services.Detached', Detached]] });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain('services.Missing');
    expect(message).toContain('services.Detached');
  });

  test('resolves when that service is named in skipBindings', async () => {
    const application = createApplication({ services: [['services.Detached', Detached]] });

    await assertArdorApplicationBoots(application, { skipBindings: ['services.Detached'] });
  });

  test('rejects a skip that matches nothing', async () => {
    const application = createApplication({ services: [['services.Dependency', Dependency]] });

    const message = await messageOf(
      assertArdorApplicationBoots(application, { skipBindings: ['services.Typo'] }),
    );

    expect(message).toContain('services.Typo');
  });

  test('rejects when the data provider is unbound, as opening the app would', async () => {
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      withoutDataProvider: true,
    });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain(CoreBindings.DEFAULT_REST_DATA_PROVIDER);
  });

  test('resolves without an auth provider', async () => {
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      withAuthProvider: false,
    });

    await assertArdorApplicationBoots(application);
  });

  // skipBindings reaches the binding check only; the provider step builds what the application bound.
  test('rejects when the bound auth provider cannot be built, as opening the app would', async () => {
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      withBrokenAuthProvider: true,
    });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain('services.Missing');
  });

  test('rejects a skip of the auth provider key: skipBindings covers the five namespaces only', async () => {
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      withBrokenAuthProvider: true,
    });

    const message = await messageOf(
      assertArdorApplicationBoots(application, {
        skipBindings: [CoreBindings.DEFAULT_AUTH_PROVIDER],
      }),
    );

    expect(message).toContain('skip matched no binding');
    expect(message).toContain(CoreBindings.DEFAULT_AUTH_PROVIDER);
  });

  test('rejects an application that binds nothing to check', async () => {
    const message = await messageOf(assertArdorApplicationBoots(createApplication()));

    expect(message).toContain('allowEmpty');
  });

  test('boots a BaseArdorApplication that binds only the REST options', async () => {
    class MinimalApplication extends BaseArdorApplication {
      getAppInfo(): IApplicationInfo {
        return { name: 'minimal', version: '0.0.0', description: 'Only the REST options' };
      }

      bindContext(): void {
        this.bind({
          key: BindingKeys.build<unknown>({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }),
        }).toValue({ url: '/api' });
      }
    }

    const application = await assertArdorApplicationBoots(() => new MinimalApplication(), {
      allowEmpty: true,
    });

    expect(application).toBeInstanceOf(MinimalApplication);
  });

  test('resolves an empty application when allowEmpty is true', async () => {
    await assertArdorApplicationBoots(createApplication(), { allowEmpty: true });
  });

  test('accepts a feature in place of a binding', async () => {
    const application = createApplication({ features: [Features.define({ name: 'reports' })] });

    await assertArdorApplicationBoots(application);
  });

  test('rejects the same instance a second time', async () => {
    const application = createApplication({ services: [['services.Dependency', Dependency]] });
    await assertArdorApplicationBoots(application);

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain('already started');
  });

  test('rejects an instance that was started outside the helper', async () => {
    const application = createApplication({ services: [['services.Dependency', Dependency]] });
    await application.start();

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain('already started');
  });

  test('accepts a factory', async () => {
    const application = await assertArdorApplicationBoots(() =>
      createApplication({ services: [['services.Dependency', Dependency]] }),
    );

    expect(
      application.isBound({ key: BindingKeys.build<unknown>({ key: 'services.Dependency' }) }),
    ).toBe(true);
  });

  test('replaces fetch with a rejecting one during the run and restores it after', async () => {
    let seen: typeof fetch | undefined;
    class Probe {
      constructor() {
        seen = globalThis.fetch;
      }
    }
    const application = createApplication({ services: [['services.Probe', Probe]] });

    await assertArdorApplicationBoots(application);

    expect(seen).toBeDefined();
    expect(seen).not.toBe(originalFetch);
    const result = await messageOf((seen as typeof fetch)('http://localhost/x'));
    expect(result).toContain('never reaches the network');
    expect(globalThis.fetch).toBe(originalFetch);
  });

  test('restores fetch when the boot fails', async () => {
    const application = createApplication({ services: [['services.Detached', Detached]] });

    await messageOf(assertArdorApplicationBoots(application));

    expect(globalThis.fetch).toBe(originalFetch);
  });

  test('rejects with the error raised while the initial locale loads, when the provider offers one locale', async () => {
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      features: [
        Features.define({
          name: 'reports',
          messages: { en: () => Promise.reject(getError({ message: 'chunk is down' })) },
        }),
      ],
    });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain('chunk is down');
  });
});

describe('assertArdorApplicationBoots messages', () => {
  const languages = [
    { locale: 'en', name: 'English' },
    { locale: 'vi', name: 'Tieng Viet' },
  ];
  const reports = Features.define({
    name: 'reports',
    messages: { en: { reports: 'Reports' }, vi: () => Promise.resolve({ reports: 'Bao cao' }) },
  });

  const realI18n = (opts: { features: ReturnType<typeof Features.define>[] }) => {
    return new DefaultI18nProvider({ languages }, opts.features).value(new Container());
  };

  test('loads the messages of every offered locale, not the initial one only', async () => {
    const lateFailure = Features.define({
      name: 'late',
      messages: { vi: () => Promise.reject(getError({ message: 'vi chunk is down' })) },
    });
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      features: [reports, lateFailure],
      i18n: realI18n({ features: [reports, lateFailure] }),
    });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain('vi chunk is down');
  });

  test('finds a key two lazy bundles define in a locale that is not the initial one', async () => {
    const first = Features.define({
      name: 'first',
      messages: { vi: () => Promise.resolve({ shared: 'A' }) },
    });
    const second = Features.define({
      name: 'second',
      messages: { vi: () => Promise.resolve({ shared: 'B' }) },
    });
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      features: [first, second],
      i18n: realI18n({ features: [first, second] }),
    });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain("Message 'shared' (vi) is defined by both 'first' and 'second'");
  });

  test('checks the fallback locale too when it is not one of the offered locales', async () => {
    const first = Features.define({
      name: 'first',
      messages: { fr: () => Promise.resolve({ shared: 'A' }) },
    });
    const second = Features.define({
      name: 'second',
      messages: { fr: () => Promise.resolve({ shared: 'B' }) },
    });
    const options = { languages, fallback: { locale: 'fr' } };
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      features: [first, second],
      i18nOptions: options,
      i18n: new DefaultI18nProvider(options, [first, second]).value(new Container()),
    });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain("Message 'shared' (fr) is defined by both 'first' and 'second'");
  });

  test('checks the default fallback locale when the options name none and it is not offered', async () => {
    const first = Features.define({
      name: 'first',
      messages: { en: () => Promise.resolve({ shared: 'A' }) },
    });
    const second = Features.define({
      name: 'second',
      messages: { en: () => Promise.resolve({ shared: 'B' }) },
    });
    const options = { languages: [{ locale: 'vi', name: 'Vietnamese' }] };
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      features: [first, second],
      i18nOptions: options,
      i18n: new DefaultI18nProvider(options, [first, second]).value(new Container()),
    });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain("Message 'shared' (en) is defined by both 'first' and 'second'");
  });

  test('leaves the locale of the provider where it was', async () => {
    const i18n = realI18n({ features: [reports] });
    const changes: Array<string> = [];
    const original = i18n.changeLocale;

    i18n.changeLocale = (next, options) => {
      changes.push(next);

      return original(next, options);
    };

    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      features: [reports],
      i18n,
    });

    await assertArdorApplicationBoots(application);

    expect(changes).toEqual([]);
    expect(i18n.getLocale()).toBe('en');
  });

  test('locale narrows the check to that one locale', async () => {
    const lateFailure = Features.define({
      name: 'late',
      messages: { vi: () => Promise.reject(getError({ message: 'vi chunk is down' })) },
    });
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      features: [lateFailure],
      i18n: realI18n({ features: [lateFailure] }),
    });

    await assertArdorApplicationBoots(application, { locale: 'en' });
  });
});

describe('the browser fakes', () => {
  test('are the ones of the kernel entry, so an app imports them from one place', () => {
    expect(Testing.FakeResizeObserver).toBe(Kernel.FakeResizeObserver);
    expect(Testing.FakeIntersectionObserver).toBe(Kernel.FakeIntersectionObserver);
    expect(Testing.FakeMatchMedia).toBe(Kernel.FakeMatchMedia);
    expect(Testing.FakeStorage).toBe(Kernel.FakeStorage);
    expect(Testing.FakeClipboard).toBe(Kernel.FakeClipboard);
  });
});
