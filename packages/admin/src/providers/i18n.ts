import { type Container, inject } from '@venizia/ignis-inversion';
import merge from 'lodash/merge.js';
import type { I18nProvider, TranslationMessages } from 'ra-core';
import polyglotI18nProvider from 'ra-i18n-polyglot';

import { BaseProvider, CoreBindings } from '@venizia/ardor-kernel';
import type { II18nProviderOptions } from '@/common';
import { englishMessages } from '@/common/locales';
import type { TFeature } from '@/features/feature';
import { FeatureMessages } from '@/features/messages';

/**
 * The options hold data (`i18nSources`, `languages`); the hooks are `resolveInitialLocale` and
 * `composeMessages`, each taking one `opts` object.
 */
export class DefaultI18nProvider extends BaseProvider<I18nProvider> {
  constructor(
    @inject({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
    protected i18nProviderOptions: II18nProviderOptions,
    @inject({ key: CoreBindings.FEATURES, isOptional: true })
    protected features: Array<TFeature> = [],
  ) {
    super({ scope: DefaultI18nProvider.name });
  }

  /**
   * The locale the admin starts in: the browser's language when it is one of `locales`, else `en`.
   * Read when the provider is built, not when the module is imported, and not at all outside a
   * browser.
   */
  protected resolveInitialLocale(opts: { locales: Array<string> }): string {
    const browserLanguage = typeof navigator === 'undefined' ? undefined : navigator.language;
    const [language] = (browserLanguage?.length ? browserLanguage : 'en-US').split('-');

    return opts.locales.includes(language) ? language : 'en';
  }

  /**
   * The messages of a locale: the features' messages first, the application's own source over them
   * (the application may relabel a feature), English for a locale the application has no source for.
   */
  protected composeMessages(opts: { locale: string; messages: object }): TranslationMessages {
    const sources: Record<string, object> = this.i18nProviderOptions.i18nSources ?? {
      en: englishMessages,
    };

    // lodash `merge` loses the message type; every source is a (partial) set of messages.
    return merge({}, opts.messages, sources[opts.locale] ?? englishMessages) as TranslationMessages;
  }

  override value(_container: Container): I18nProvider {
    const { languages = [{ locale: 'en', name: 'English' }] } = this.i18nProviderOptions;

    const initialLocale = this.resolveInitialLocale({
      locales: languages.map(({ locale }) => locale),
    });

    const featureMessages = new FeatureMessages({ features: this.features });

    // ra-i18n-polyglot reads the initial locale synchronously, once, while it is built: that read
    // takes what is there now, and ArdorApplication loads the rest through changeLocale() before
    // react-admin renders. Every later read may wait for a lazy bundle.
    let isBuilding = true;

    const i18nProvider = polyglotI18nProvider(
      (locale) => {
        if (isBuilding || !featureMessages.isPending({ locale })) {
          return this.composeMessages({ locale, messages: featureMessages.readNow({ locale }) });
        }

        return featureMessages
          .read({ locale })
          .then((messages) => this.composeMessages({ locale, messages }));
      },
      initialLocale,
      languages,
      {
        allowMissing: true,
        onMissingKey: (key: string, _options: unknown, _locale: unknown) => key,
      },
    );

    isBuilding = false;
    return i18nProvider;
  }
}
