import 'reflect-metadata';

import { afterEach, describe, expect, test } from 'bun:test';

import { Features } from '@venizia/ardor-admin';
import {
  BaseArdorApplication,
  CoreBindings,
  inject,
  type IApplicationInfo,
} from '@venizia/ardor-kernel';
import { getError } from '@venizia/ignis-inversion';
import { assertArdorApplicationBoots, FakeResizeObserver } from '@/testing';

class Dependency {}

class Orders {
  constructor(@inject({ key: 'services.Dependency' }) readonly dependency: Dependency) {}
}

class Detached {
  constructor(@inject({ key: 'services.Missing' }) readonly missing: unknown) {}
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
  i18n?: typeof i18nProvider;
}

const createApplication = (opts: IFixtureOptions = {}) => {
  const {
    services = [],
    withoutDataProvider = false,
    withAuthProvider = false,
    withBrokenAuthProvider = false,
    features,
    i18n = i18nProvider,
  } = opts;

  class FixtureApplication extends BaseArdorApplication {
    getAppInfo(): IApplicationInfo {
      return { name: 'fixture', version: '0.0.0', description: 'A fixture' };
    }

    bindContext(): void {
      if (!withoutDataProvider) {
        this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue(dataProvider);
      }
      this.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toValue(i18n);
      if (withAuthProvider) {
        this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toValue(authProvider);
      }
      if (withBrokenAuthProvider) {
        this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toClass(Detached);
      }
      if (features) {
        this.bind({ key: CoreBindings.FEATURES }).toValue(features);
      }
      for (const [key, target] of services) {
        this.bind({ key }).toClass(target);
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

    expect(application.isBound({ key: 'services.Dependency' })).toBe(true);
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

  test('rejects with the error raised while the first locale loads', async () => {
    const application = createApplication({
      services: [['services.Dependency', Dependency]],
      features: [Features.define({ name: 'reports', messages: { en: () => Promise.resolve({}) } })],
      i18n: {
        getLocale: () => 'en',
        changeLocale: () => Promise.reject(getError({ message: 'key defined twice' })),
      },
    });

    const message = await messageOf(assertArdorApplicationBoots(application));

    expect(message).toContain('key defined twice');
  });
});

describe('FakeResizeObserver', () => {
  const targetOf = (): Element => {
    const target: unknown = { tagName: 'DIV' };
    return target as Element;
  };

  test('install swaps the global observer and the returned function puts the previous one back', () => {
    const previous = Reflect.get(globalThis, 'ResizeObserver');

    const restore = FakeResizeObserver.install();
    expect(Reflect.get(globalThis, 'ResizeObserver')).toBe(FakeResizeObserver);

    restore();
    expect(Reflect.get(globalThis, 'ResizeObserver')).toBe(previous);
  });

  test('flush calls an observer of the element once, with the size in every box', () => {
    const restore = FakeResizeObserver.install();
    const element = targetOf();
    const received: Array<ResizeObserverEntry> = [];
    const observer = new ResizeObserver((entries) => {
      received.push(...entries);
    });
    observer.observe(element);

    FakeResizeObserver.flush({ element, width: 120, height: 40 });

    expect(received).toHaveLength(1);
    const [entry] = received;
    expect(entry?.target).toBe(element);
    expect(entry?.contentRect.width).toBe(120);
    expect(entry?.contentRect.height).toBe(40);
    expect(entry?.borderBoxSize[0]).toEqual({ inlineSize: 120, blockSize: 40 });
    expect(entry?.contentBoxSize[0]).toEqual({ inlineSize: 120, blockSize: 40 });
    restore();
  });

  test('flush skips an element nobody observes, one that was unobserved and a disconnected observer', () => {
    const restore = FakeResizeObserver.install();
    const watched = targetOf();
    const other = targetOf();
    const calls: Array<string> = [];
    const first = new ResizeObserver(() => calls.push('first'));
    const second = new ResizeObserver(() => calls.push('second'));
    first.observe(watched);
    first.unobserve(watched);
    second.observe(watched);
    second.disconnect();

    FakeResizeObserver.flush({ element: watched, width: 1, height: 1 });
    FakeResizeObserver.flush({ element: other, width: 1, height: 1 });

    expect(calls).toEqual([]);
    restore();
  });

  test('flush reaches every observer of the same element', () => {
    const restore = FakeResizeObserver.install();
    const element = targetOf();
    const calls: Array<string> = [];
    new ResizeObserver(() => calls.push('a')).observe(element);
    new ResizeObserver(() => calls.push('b')).observe(element);

    FakeResizeObserver.flush({ element, width: 5, height: 5 });

    expect(calls).toEqual(['a', 'b']);
    restore();
  });

  test('install forgets the observers of an earlier install', () => {
    const restoreFirst = FakeResizeObserver.install();
    const element = targetOf();
    const calls: Array<string> = [];
    new ResizeObserver(() => calls.push('stale')).observe(element);
    restoreFirst();

    const restore = FakeResizeObserver.install();
    FakeResizeObserver.flush({ element, width: 5, height: 5 });

    expect(calls).toEqual([]);
    restore();
  });
});
