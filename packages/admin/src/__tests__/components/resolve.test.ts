import { describe, expect, mock, test } from 'bun:test';

import { loadFeatureMessages, resolveApplicationProviders } from '@/components/resolve';
import { rejectionOf } from '@venizia/dev-configs/testing';
import { Features } from '@/features';
import { CoreBindings } from '@venizia/ardor-kernel';
import { Container, getError } from '@venizia/ignis-inversion';

const authProvider = {
  checkAuth: () => Promise.resolve(),
  checkError: () => Promise.resolve(),
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  getPermissions: () => Promise.resolve(),
};

const createContainer = (opts: { withAuthProvider: boolean; withI18nProvider?: boolean }) => {
  const container = new Container();
  container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({ id: 'data' });
  if (opts.withAuthProvider) {
    container.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toValue(authProvider);
  }
  if (opts.withI18nProvider ?? true) {
    container.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toValue({ id: 'i18n' });
  }
  return container;
};

describe('resolveApplicationProviders', () => {
  test('returns the data, auth and i18n providers the application bound', () => {
    const providers = resolveApplicationProviders({
      container: createContainer({ withAuthProvider: true }),
    });

    expect(providers.dataProvider as unknown).toEqual({ id: 'data' });
    expect(providers.authProvider as unknown).toBe(authProvider);
    expect(providers.i18nProvider as unknown).toEqual({ id: 'i18n' });
  });

  test('leaves the auth provider out when the application has no sign-in', () => {
    const providers = resolveApplicationProviders({
      container: createContainer({ withAuthProvider: false }),
    });

    expect(Object.keys(providers).sort()).toEqual(['dataProvider', 'i18nProvider']);
  });

  test('throws when the data provider is unbound', () => {
    const container = new Container();
    container.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toValue({});

    expect(() => resolveApplicationProviders({ container })).toThrow(
      CoreBindings.DEFAULT_REST_DATA_PROVIDER,
    );
  });

  test('throws when the i18n provider is unbound', () => {
    expect(() =>
      resolveApplicationProviders({
        container: createContainer({ withAuthProvider: true, withI18nProvider: false }),
      }),
    ).toThrow(CoreBindings.DEFAULT_I18N_PROVIDER);
  });
});

describe('loadFeatureMessages', () => {
  const featureWithLazyEnglish = Features.define({
    name: 'reports',
    messages: { en: () => Promise.resolve({ reports: { title: 'Reports' } }) },
  });

  test('changes to the initial locale when a feature loads it lazily', async () => {
    const changeLocale = mock(() => Promise.resolve());
    const i18nProvider = { getLocale: () => 'en', changeLocale };

    await loadFeatureMessages({
      features: [featureWithLazyEnglish],
      i18nProvider: i18nProvider as never,
    });

    expect(changeLocale).toHaveBeenCalledWith('en');
  });

  test('does nothing when no feature loads the locale lazily', async () => {
    const changeLocale = mock(() => Promise.resolve());
    const i18nProvider = { getLocale: () => 'fr', changeLocale };

    await loadFeatureMessages({
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

    const error = await rejectionOf(
      loadFeatureMessages({
        features: [featureWithLazyEnglish],
        i18nProvider: i18nProvider as never,
      }),
    );

    expect((error as Error).message).toContain('key defined twice');
  });
});
