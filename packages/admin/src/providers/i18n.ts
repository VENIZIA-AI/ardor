import { RecordUtility } from '@venizia/ignis-helpers/core';
import { type Container, inject } from '@venizia/ignis-inversion';
import type { I18nProvider, TranslationMessages } from 'ra-core';
import polyglotI18nProvider from 'ra-i18n-polyglot';

import {
  BaseProvider,
  BrowserStorage,
  CoreBindings,
  type IApplicationInfo,
  LocalStorageKeys,
  StorageCodecs,
} from '@venizia/ardor-kernel';
import type { II18nProviderOptions } from '@/common';
import { englishMessages } from '@/common/locales';
import { deepMerge } from '@/common/merge';
import type { TFeature } from '@/features/feature';
import { FeatureMessagesHelper } from '@/helpers/feature-messages';
import { LocaleSourcesHelper } from '@/helpers/locale-sources';
import { LazyLocalesUtility } from '@/utilities/lazy-locales';

/**
 * The options hold data (`i18nSources`, `languages`); the hooks are `resolveInitialLocale` and
 * `composeMessages`, each taking one `opts` object.
 *
 * @example
 * ```ts
 * import { configuration, CoreBindings, englishMessages, provide, vietnameseMessages } from '@venizia/ardor';
 *
 * @configuration()
 * export class I18nConfiguration {
 *   @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
 *   options() {
 *     return {
 *       languages: [{ locale: 'en', name: 'English' }, { locale: 'vi', name: 'Tieng Viet' }],
 *       i18nSources: {
 *         en: englishMessages,
 *         // A loader runs the first time the locale is used, such as () => import('./vi').
 *         vi: async () => vietnameseMessages,
 *       },
 *     };
 *   }
 * }
 * ```
 */
export class DefaultI18nProvider extends BaseProvider<I18nProvider> {
  private static readonly DEFAULT_LOCALE = 'en';

  protected localeSources: LocaleSourcesHelper;
  /** Where the chosen locale is kept; absent when it is not persisted. Set by `value()` before the initial locale is read. */
  private localeKey?: string;

  constructor(
    @inject({ key: CoreBindings.I18N_PROVIDER_OPTIONS, isOptional: true })
    protected i18nProviderOptions: II18nProviderOptions = {},
    @inject({ key: CoreBindings.FEATURES, isOptional: true })
    protected features: Array<TFeature> = [],
  ) {
    super({ scope: DefaultI18nProvider.name });
    this.localeSources = new LocaleSourcesHelper({
      sources: i18nProviderOptions.i18nSources ?? { en: englishMessages },
      logger: this.logger,
    });
  }

  /**
   * The locale the admin starts in, read when the provider is built, not when the module is imported:
   * the stored locale; else the first of the browser's languages (`navigator.languages`) that
   * `locales` offers, each tried as the full tag (`pt-BR`) and then as its primary subtag
   * (`pt`); else the first of `locales`; else `en`.
   */
  protected resolveInitialLocale(opts: { locales: Array<string> }): string {
    const stored = this.localeKey
      ? BrowserStorage.get({
          key: this.localeKey,
          fallback: undefined,
          codec: StorageCodecs.text({ allowed: opts.locales }),
        })
      : undefined;

    if (stored) {
      return stored;
    }

    // A runtime with a `navigator` may lack `language` or `languages` (Bun, a test DOM).
    const tags = (
      typeof navigator === 'undefined' ? [] : [navigator.language, ...(navigator.languages ?? [])]
    ).filter((tag): tag is string => typeof tag === 'string');

    for (const tag of tags) {
      for (const candidate of [tag, tag.split('-')[0]]) {
        const match = opts.locales.find(
          (locale) => locale.toLowerCase() === candidate.toLowerCase(),
        );

        if (match) {
          return match;
        }
      }
    }

    return opts.locales[0] ?? DefaultI18nProvider.DEFAULT_LOCALE;
  }

  /**
   * The messages of a locale, later over earlier: ARDOR's English, the features' and the
   * application's messages of the fallback locale, then the features' (`messages`) and the
   * application's own of the locale. A lazy source that has not loaded or failed to load adds nothing.
   */
  protected composeMessages(opts: {
    locale: string;
    messages: object;
    fallback?: { locale: string; messages: object };
  }): TranslationMessages {
    const { locale, messages } = opts;
    const fallback = opts.fallback ?? { locale: this.fallbackLocale, messages: {} };

    // A merge of (partial) message sets is a set of messages, which a merge that takes any object
    // cannot say in its type: the assertion is here, where the sources are known, not inside it.
    return deepMerge({
      sources: [
        englishMessages,
        fallback.messages,
        messages,
        this.localeSources.readNow({ locale: fallback.locale }) ?? {},
        this.localeSources.readNow({ locale }) ?? {},
      ],
    }) as TranslationMessages;
  }

  protected get fallbackLocale(): string {
    return this.i18nProviderOptions.fallback?.locale ?? DefaultI18nProvider.DEFAULT_LOCALE;
  }

  override value(container: Container): I18nProvider {
    const { languages = [{ locale: 'en', name: 'English' }] } = this.i18nProviderOptions;
    const { fallbackLocale } = this;
    const locales = languages.map(({ locale }) => locale);

    const id = container.get<IApplicationInfo>({
      key: CoreBindings.APPLICATION_INFO,
      isOptional: true,
    })?.id;
    this.localeKey =
      this.i18nProviderOptions.locale?.persist?.use === false
        ? undefined
        : LocalStorageKeys.scoped({ id }).locale;

    const initialLocale = this.resolveInitialLocale({ locales });

    const featureMessages = new FeatureMessagesHelper({ features: this.features });

    // A key two features define is a mistake of the build, found here for every locale the messages
    // can be read in, never when a user switches language.
    for (const locale of new Set([...locales, fallbackLocale])) {
      featureMessages.readNow({ locale });
    }

    const logFailure = (opts: { locale: string; error: unknown }) => {
      this.logger.error(
        '[load] Messages of the features for locale %s failed to load, the fallback messages are used | error: %o',
        opts.locale,
        opts.error,
      );
    };

    // What is there now, for a locale that has no source of its own to fall back on: never throws.
    const readFeaturesNow = (locale: string): object => {
      try {
        return featureMessages.readNow({ locale });
      } catch (error) {
        logFailure({ locale, error });

        return {};
      }
    };

    // The locales a read of `locale` needs: the fallback's messages are layered under its own.
    const readSet = (locale: string) => [...new Set([fallbackLocale, locale])];

    const isPending = (locale: string) => {
      return readSet(locale).some((item) => {
        return (
          featureMessages.isPending({ locale: item }) ||
          this.localeSources.isPending({ locale: item })
        );
      });
    };

    const composeNow = (locale: string) => {
      return this.composeMessages({
        locale,
        messages: readFeaturesNow(locale),
        fallback: { locale: fallbackLocale, messages: readFeaturesNow(fallbackLocale) },
      });
    };

    // ra-i18n-polyglot reads the initial locale synchronously, once, while it is built: that read
    // takes what is there now, and ArdorApplication loads the rest through changeLocale() before
    // react-admin renders. Every later read may wait for a lazy bundle.
    let isBuilding = true;
    const reported = new Set<string>();

    const i18nProvider = polyglotI18nProvider(
      (locale) => {
        if (isBuilding || !isPending(locale)) {
          return composeNow(locale);
        }

        // A failed load is logged and adds nothing, so the switch always goes ahead and the next one
        // tries again.
        return Promise.all(
          readSet(locale).flatMap((item) => [
            featureMessages.read({ locale: item }).catch((error: unknown) => {
              logFailure({ locale: item, error });
            }),
            this.localeSources.read({ locale: item }),
          ]),
        ).then(() => composeNow(locale));
      },
      initialLocale,
      languages,
      {
        allowMissing: true,
        onMissingKey: (key: string, options: unknown, locale: string) => {
          const entry = `${locale}:${key}`;

          if (!reported.has(entry)) {
            reported.add(entry);
            this.logger.warn('[translate] Missing message %s for locale %s', key, locale);
          }

          // A default text makes polyglot fill the tokens and plural forms of the key itself.
          // A number is polyglot's shorthand for the plural count.
          const extra = typeof options === 'number' ? { ['smart_count']: options } : options;

          return i18nProvider.translate(key, {
            ...(RecordUtility.isPlainRecord(extra) ? extra : {}),
            _: key,
          });
        },
      },
    );

    isBuilding = false;

    const { localeKey } = this;

    if (localeKey) {
      const change = i18nProvider.changeLocale;

      // Only a real change is a choice: the shell's load of the starting locale is not one.
      i18nProvider.changeLocale = async (locale, options) => {
        const previous = i18nProvider.getLocale();
        await change(locale, options);

        if (locale !== previous && locales.includes(locale)) {
          BrowserStorage.set({ key: localeKey, value: locale, codec: StorageCodecs.text() });
        }
      };
    }

    LazyLocalesUtility.register({
      provider: i18nProvider,
      isPending: (opts) => isPending(opts.locale),
    });

    return i18nProvider;
  }
}
