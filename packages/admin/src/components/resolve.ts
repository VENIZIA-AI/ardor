import type { Container } from '@venizia/ignis-inversion';
import type { I18nProvider } from 'ra-core';

import { CoreBindings } from '@venizia/ardor-kernel';
import type { IAuthProvider, IDataProvider } from '@/common';
import { type TFeature } from '@/features/feature';
import { FeatureMessages } from '@/features/messages';

/**
 * What `ArdorApplication` resolves from the container when it mounts: the one place, so a test of
 * the boot resolves exactly what the app does.
 */
export const resolveApplicationProviders = (opts: {
  container: Container;
}): { dataProvider: IDataProvider; authProvider?: IAuthProvider; i18nProvider: I18nProvider } => {
  const { container } = opts;

  const dataProvider = container.get<IDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });
  // Optional: an application with no sign-in leaves it unbound, and react-admin then runs
  // without an auth provider - every page is public.
  const authProvider = container.get<IAuthProvider>({
    key: CoreBindings.DEFAULT_AUTH_PROVIDER,
    isOptional: true,
  });
  const i18nProvider = container.get<I18nProvider>({
    key: CoreBindings.DEFAULT_I18N_PROVIDER,
  });

  return { dataProvider, ...(authProvider ? { authProvider } : {}), i18nProvider };
};

/** Whether a feature loads the provider's current locale lazily, so a first render must wait for it. */
export const hasPendingFeatureMessages = (opts: {
  features: Array<TFeature>;
  i18nProvider: I18nProvider;
}): boolean => {
  const { features, i18nProvider } = opts;
  return FeatureMessages.hasLoader({ features, locale: i18nProvider.getLocale() });
};

/**
 * Loads the lazy messages of the locale: `changeLocale()` to the same locale loads them before
 * react-admin renders. A failed load, such as a key two features define, rejects.
 */
export const loadFeatureMessages = async (opts: {
  features: Array<TFeature>;
  i18nProvider: I18nProvider;
  locale?: string;
}): Promise<void> => {
  const { features, i18nProvider } = opts;
  const locale = opts.locale ?? i18nProvider.getLocale();

  if (!FeatureMessages.hasLoader({ features, locale })) {
    return;
  }

  await i18nProvider.changeLocale(locale);
};
