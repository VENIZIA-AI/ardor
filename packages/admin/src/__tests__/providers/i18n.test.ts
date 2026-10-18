import { describe, expect, test } from 'bun:test';
import { Container } from '@venizia/ignis-inversion';

import { DefaultI18nProvider } from '@/providers/i18n';

describe('DefaultI18nProvider', () => {
  test('translates ra.action.add to Add from englishMessages and uses en as initial locale with default options', () => {
    const container = new Container();
    const provider = new DefaultI18nProvider({});
    const i18n = provider.value(container);

    expect(i18n.getLocale()).toBe('en');
    expect(i18n.translate('ra.action.add')).toBe('Add');
  });

  test('returns the key itself when translation key is missing', () => {
    const container = new Container();
    const provider = new DefaultI18nProvider({});
    const i18n = provider.value(container);

    expect(i18n.translate('missing.action.key')).toBe('missing.action.key');
  });

  test('translates key with custom locale source after changeLocale and falls back to englishMessages for missing source', async () => {
    const container = new Container();
    const provider = new DefaultI18nProvider({
      i18nSources: {
        vi: {
          ra: {
            action: {
              add: 'Them',
            },
          },
        },
      },
      languages: [{ locale: 'vi', name: 'Tieng Viet' }],
    });
    const i18n = provider.value(container);

    await i18n.changeLocale('vi');
    expect(i18n.translate('ra.action.add')).toBe('Them');

    await i18n.changeLocale('fr');
    expect(i18n.translate('ra.action.add')).toBe('Add');
  });

  test('returns default languages when options omit languages', () => {
    const container = new Container();
    const provider = new DefaultI18nProvider({});
    const i18n = provider.value(container);

    expect(i18n.getLocales?.()).toEqual([{ locale: 'en', name: 'English' }]);
  });

  test('returns languages matching configured options', () => {
    const container = new Container();
    const languages = [{ locale: 'vi', name: 'Tieng Viet' }];
    const provider = new DefaultI18nProvider({
      languages,
    });
    const i18n = provider.value(container);

    expect(i18n.getLocales?.()).toEqual(languages);
  });
});

describe('DefaultI18nProvider hooks', () => {
  const setNavigatorLanguage = (language: string | undefined) => {
    Object.defineProperty(navigator, 'language', { value: language, configurable: true });
  };

  test('reads navigator.language when the provider is built, not when the module is imported', () => {
    const original = navigator.language;

    try {
      setNavigatorLanguage('vi-VN');
      const i18n = new DefaultI18nProvider({
        languages: [
          { locale: 'en', name: 'English' },
          { locale: 'vi', name: 'Tieng Viet' },
        ],
      }).value(new Container());
      expect(i18n.getLocale()).toBe('vi');

      setNavigatorLanguage('fr-FR');
      const unlisted = new DefaultI18nProvider({
        languages: [
          { locale: 'en', name: 'English' },
          { locale: 'vi', name: 'Tieng Viet' },
        ],
      }).value(new Container());
      expect(unlisted.getLocale()).toBe('en');
    } finally {
      setNavigatorLanguage(original);
    }
  });

  test('resolveInitialLocale decides the initial locale', () => {
    class StoredLocaleProvider extends DefaultI18nProvider {
      protected override resolveInitialLocale(opts: { locales: Array<string> }) {
        return opts.locales.includes('vi') ? 'vi' : 'en';
      }
    }

    const i18n = new StoredLocaleProvider({
      languages: [{ locale: 'vi', name: 'Tieng Viet' }],
    }).value(new Container());

    expect(i18n.getLocale()).toBe('vi');
  });

  test('composeMessages decides the messages of a locale', () => {
    class BrandedProvider extends DefaultI18nProvider {
      protected override composeMessages(opts: { locale: string; messages: object }) {
        return { ...super.composeMessages(opts), app: { brand: 'Ardor (branded)' } };
      }
    }

    const i18n = new BrandedProvider({}).value(new Container());

    expect(i18n.translate('app.brand')).toBe('Ardor (branded)');
    expect(i18n.translate('ra.action.add')).toBe('Add');
  });
});
