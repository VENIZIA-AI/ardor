import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { BaseArdorApplication } from '@/base/applications/abstract';
import { MetadataRegistry } from '@venizia/ignis-kernel/metadata';
import { configuration, provideOption } from '@/base/metadata';
import {
  CoreBindings,
  type IApplicationInfo,
  type IAuthProviderOptions,
  type IRestDataProviderOptions,
} from '@/common';

class TestApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'provide-option-test', version: '1.0.0', description: 'typed option keys' };
  }

  bindContext(): void {}
}

@configuration()
class OptionsConfiguration {
  @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: 'https://api.example.com', noAuthPaths: ['/auth/sign-in'] };
  }

  @provideOption({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): IAuthProviderOptions {
    return { paths: { signIn: '/session' } };
  }
}

// A return type left to inference: a narrower object literal still fits.
class InferredOptions {
  @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return { url: '/inferred' };
  }
}

// The type-level cases: each `@ts-expect-error` line must be an error, and `make typecheck` fails on
// an unused directive, so a decorator that accepts the wrong method turns the check red.
class RefusedOptions {
  // @ts-expect-error a number is not IRestDataProviderOptions
  @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  wrongReturnType() {
    return 42;
  }

  // @ts-expect-error the url of IRestDataProviderOptions is required
  @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  missingUrl() {
    return { noAuthPaths: [] };
  }

  // @ts-expect-error the options of one key do not fit another
  @provideOption({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  anotherKeysOptions(): IRestDataProviderOptions {
    return { url: '/api' };
  }

  // @ts-expect-error a promise is bound as a promise, never awaited
  @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  async promised(): Promise<IRestDataProviderOptions> {
    return { url: '/api' };
  }

  // @ts-expect-error a key that is not an options key of ICoreOptionTypes
  @provideOption({ key: 'app.not.an.option.key' })
  unknownKey() {
    return {};
  }

  // @ts-expect-error a method that takes a parameter is not a provider
  @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  takesParameter(base: string): IRestDataProviderOptions {
    return { url: base };
  }
}

describe('provideOption', () => {
  const registry = MetadataRegistry.getInstance();
  let discovered: ReturnType<typeof registry.getDiscoveredArtifacts> = [];

  beforeEach(() => {
    discovered = registry.getDiscoveredArtifacts();
  });

  afterEach(() => {
    registry.clearDiscoveredArtifacts();

    for (const target of discovered) {
      registry.addDiscoveredArtifact({ target });
    }
  });

  test('binds the options under their key, as @provide does', async () => {
    const application = new TestApplication();
    await application.start();

    expect(
      application.get<IRestDataProviderOptions>({
        key: CoreBindings.REST_DATA_PROVIDER_OPTIONS,
      }),
    ).toEqual({ url: 'https://api.example.com', noAuthPaths: ['/auth/sign-in'] });
    expect(
      application.get<IAuthProviderOptions>({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }),
    ).toEqual({ paths: { signIn: '/session' } });
  });

  test('records the key and the method on the class', () => {
    expect(registry.getProvideMetadata({ target: OptionsConfiguration })).toEqual([
      { methodName: 'restDataProviderOptions', key: CoreBindings.REST_DATA_PROVIDER_OPTIONS },
      { methodName: 'authProviderOptions', key: CoreBindings.AUTH_PROVIDER_OPTIONS },
    ]);
  });

  test('the methods of the compile-time cases still run as plain methods', () => {
    expect(new RefusedOptions().wrongReturnType()).toBe(42);
    expect(new InferredOptions().restDataProviderOptions()).toEqual({ url: '/inferred' });
  });
});
