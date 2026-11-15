import { describe, expect, mock, test } from 'bun:test';

import { ApplicationProviders } from '@/components/resolve';
import { RejectionHelper } from '@venizia/dev-configs/testing';
import { Features } from '@/features';
import { CoreBindings, type TAuthProviderOptions } from '@venizia/ardor-kernel';
import { Container, getError } from '@venizia/ignis-inversion';

const authProvider = {
  checkAuth: () => Promise.resolve(),
  checkError: () => Promise.resolve(),
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  getPermissions: () => Promise.resolve(),
};

const createContainer = (opts: {
  withAuthProvider: boolean;
  withI18nProvider?: boolean;
  authOptions?: TAuthProviderOptions;
}) => {
  const container = new Container();
  container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({ id: 'data' });

  if (opts.withAuthProvider) {
    container.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toValue(authProvider);
  }

  if (opts.authOptions) {
    container.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue(opts.authOptions);
  }

  if (opts.withI18nProvider ?? true) {
    container.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toValue({ id: 'i18n' });
  }

  return container;
};

const signInOff: Array<TAuthProviderOptions | undefined> = [undefined, { use: false }];

describe('ApplicationProviders.resolve', () => {
  test('returns the data, auth and i18n providers the application bound, with sign-in on', () => {
    const providers = ApplicationProviders.resolve({
      container: createContainer({ withAuthProvider: true, authOptions: { use: true } }),
    });

    expect(providers.dataProvider as unknown).toEqual({ id: 'data' });
    expect(providers.authProvider as unknown).toBe(authProvider);
    expect(providers.i18nProvider as unknown).toEqual({ id: 'i18n' });
  });

  test('with isAuthRequired the auth provider is typed as present, and an unbound one throws', () => {
    const providers = ApplicationProviders.resolve({
      container: createContainer({ withAuthProvider: true, authOptions: { use: true } }),
      isAuthRequired: true,
    });
    // No optional chaining or assertion: the type says the provider is there.
    const login: unknown = providers.authProvider.login;

    expect(login).toBe(authProvider.login);
    expect(() => {
      ApplicationProviders.resolve({
        container: createContainer({ withAuthProvider: false, authOptions: { use: true } }),
        isAuthRequired: true,
      });
    }).toThrow(CoreBindings.DEFAULT_AUTH_PROVIDER);
  });

  test('leaves a bound auth provider out unless the options say { use: true }', () => {
    for (const authOptions of signInOff) {
      const providers = ApplicationProviders.resolve({
        container: createContainer({ withAuthProvider: true, authOptions }),
      });

      expect(providers.authProvider).toBeUndefined();
    }
  });

  test('isAuthRequired with sign-in off throws, saying to set { use: true }', () => {
    for (const authOptions of signInOff) {
      expect(() => {
        ApplicationProviders.resolve({
          container: createContainer({ withAuthProvider: true, authOptions }),
          isAuthRequired: true,
        });
      }).toThrow('{ use: true }');
    }
  });

  test('options bound without the use toggle throw, naming the key and saying to add use: true', () => {
    // An app written before the toggle binds `{ paths }`: it must not silently run with every page public.
    const legacy = { paths: { signIn: '/auth/sign-in' } };
    const container = createContainer({ withAuthProvider: true });
    container.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue(legacy);

    expect(() => {
      ApplicationProviders.resolve({ container });
    }).toThrow(CoreBindings.AUTH_PROVIDER_OPTIONS);
    expect(() => {
      ApplicationProviders.resolve({ container });
    }).toThrow('use: true');
  });

  test('leaves the auth provider out when the application has no sign-in', () => {
    const providers = ApplicationProviders.resolve({
      container: createContainer({ withAuthProvider: false }),
    });

    expect(Object.keys(providers).sort()).toEqual(['dataProvider', 'i18nProvider']);
  });

  test('throws when the data provider is unbound', () => {
    const container = new Container();
    container.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toValue({});

    expect(() => ApplicationProviders.resolve({ container })).toThrow(
      CoreBindings.DEFAULT_REST_DATA_PROVIDER,
    );
  });

  test('throws when the i18n provider is unbound', () => {
    expect(() =>
      ApplicationProviders.resolve({
        container: createContainer({ withAuthProvider: true, withI18nProvider: false }),
      }),
    ).toThrow(CoreBindings.DEFAULT_I18N_PROVIDER);
  });
});

describe('Features.loadMessages', () => {
  const featureWithLazyEnglish = Features.define({
    name: 'reports',
    messages: { en: () => Promise.resolve({ reports: { title: 'Reports' } }) },
  });

  test('changes to the initial locale when a feature loads it lazily', async () => {
    const changeLocale = mock(() => Promise.resolve());
    const i18nProvider = { getLocale: () => 'en', changeLocale };

    await Features.loadMessages({
      features: [featureWithLazyEnglish],
      i18nProvider: i18nProvider as never,
    });

    expect(changeLocale).toHaveBeenCalledWith('en');
  });

  test('does nothing when no feature loads the locale lazily', async () => {
    const changeLocale = mock(() => Promise.resolve());
    const i18nProvider = { getLocale: () => 'fr', changeLocale };

    await Features.loadMessages({
      features: [featureWithLazyEnglish],
      i18nProvider: i18nProvider as never,
    });

    expect(changeLocale).not.toHaveBeenCalled();
  });

  test('rejects with the error the locale change raised', async () => {
    const i18nProvider = {
      getLocale: () => 'en',
      changeLocale: () => Promise.reject(getError({ message: 'key defined twice' })),
    };

    const error = await RejectionHelper.rejectionOf({
      task: Features.loadMessages({
        features: [featureWithLazyEnglish],
        i18nProvider: i18nProvider as never,
      }),
    });

    expect((error as Error).message).toContain('key defined twice');
  });
});
