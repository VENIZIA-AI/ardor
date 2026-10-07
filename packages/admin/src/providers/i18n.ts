import { Container, inject } from '@venizia/ignis-inversion';
import merge from 'lodash/merge.js';
import { type I18nProvider } from 'ra-core';
import polyglotI18nProvider from 'ra-i18n-polyglot';

import { BaseProvider, CoreBindings } from '@venizia/ardor-kernel';
import { type II18nProviderOptions } from '@/common';
import { englishMessages } from '@/common/locales';
import { type IFeature } from '@/features/feature';
import { FeatureMessages } from '@/features/messages';

const [language] = (navigator?.language?.length ? navigator.language : 'en-US').split('-');

export class DefaultI18nProvider extends BaseProvider<I18nProvider> {
  constructor(
    @inject({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
    protected i18nProviderOptions: II18nProviderOptions,
    @inject({ key: CoreBindings.FEATURES, isOptional: true })
    protected features: Array<IFeature> = [],
  ) {
    super({ scope: DefaultI18nProvider.name });
  }

  override value(_container: Container): I18nProvider {
    const {
      i18nSources = { en: englishMessages },
      listLanguages = [{ locale: 'en', name: 'English' }],
    } = this.i18nProviderOptions;

    const listLocales = listLanguages.map(({ locale }) => locale);

    const initialLocale = listLocales.includes(language) ? language : 'en';

    // The features' messages first, the application's own sources over them: the application may
    // relabel a feature.
    const featureMessages = new FeatureMessages({ features: this.features });
    const compose = (opts: { locale: string; messages: object }) => {
      return merge({}, opts.messages, i18nSources?.[opts.locale] ?? englishMessages);
    };

    // ra-i18n-polyglot reads the initial locale synchronously, once, while it is built: that read
    // takes what is there now, and ArdorApplication loads the rest through changeLocale() before
    // react-admin renders. Every later read may wait for a lazy bundle.
    let isBuilding = true;

    const i18nProvider = polyglotI18nProvider(
      (locale) => {
        if (isBuilding || !featureMessages.isPending({ locale })) {
          return compose({ locale, messages: featureMessages.readNow({ locale }) });
        }

        return featureMessages.read({ locale }).then((messages) => compose({ locale, messages }));
      },
      initialLocale,
      listLanguages,
      {
        allowMissing: true,
        onMissingKey: (key: string, _options: unknown, _locale: unknown) => key,
      },
    );

    isBuilding = false;
    return i18nProvider;
  }
}
