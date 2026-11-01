import { describe, expect, mock, spyOn, test } from 'bun:test';
import { Container } from '@venizia/ignis-inversion';

import type { TI18nSource } from '@/common';
import { Features } from '@/features';
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

describe('DefaultI18nProvider lazy sources', () => {
  const vietnamese = { ra: { action: { add: 'Them' } } };

  /** A provider that starts in `locale`, as the browser's language would decide. */
  const startingIn = (opts: { locale: string; sources: Record<string, TI18nSource> }) => {
    class StartingProvider extends DefaultI18nProvider {
      protected override resolveInitialLocale(): string {
        return opts.locale;
      }
    }

    const provider = new StartingProvider({
      i18nSources: opts.sources,
      languages: [
        { locale: 'en', name: 'English' },
        { locale: 'vi', name: 'Tieng Viet' },
      ],
    });
    const error = spyOn(provider.logger, 'error').mockImplementation(() => undefined);

    return { provider, error, i18n: provider.value(new Container()) };
  };

  test('a loader is not called while the provider is built, but when its locale is used, and not again once it delivered', async () => {
    const load = mock(() => Promise.resolve(vietnamese));
    const { i18n } = startingIn({ locale: 'en', sources: { vi: load } });

    expect(load).not.toHaveBeenCalled();

    await i18n.changeLocale('vi');
    await i18n.changeLocale('vi');

    expect(load).toHaveBeenCalledTimes(1);
    expect(i18n.translate('ra.action.add')).toBe('Them');
  });

  test('a lazy initial locale reports itself pending, and loadMessages delivers it before the first render', async () => {
    const load = mock(() => Promise.resolve(vietnamese));
    const { i18n } = startingIn({ locale: 'vi', sources: { vi: load } });

    expect(Features.hasPendingMessages({ features: [], i18nProvider: i18n })).toBe(true);

    await Features.loadMessages({ features: [], i18nProvider: i18n });

    expect(Features.hasPendingMessages({ features: [], i18nProvider: i18n })).toBe(false);
    expect(i18n.translate('ra.action.add')).toBe('Them');
  });

  test('an object source and a provider with no lazy source are never pending', () => {
    const { i18n } = startingIn({ locale: 'vi', sources: { vi: vietnamese } });

    expect(Features.hasPendingMessages({ features: [], i18nProvider: i18n })).toBe(false);
    expect(i18n.translate('ra.action.add')).toBe('Them');
  });

  test('a loader that fails leaves the locale on English, logs it, and is tried again on the next changeLocale', async () => {
    const load = mock<() => Promise<object>>()
      .mockRejectedValueOnce(new Error('remote file is down'))
      .mockResolvedValueOnce(vietnamese);
    const { i18n, error } = startingIn({ locale: 'en', sources: { vi: load } });

    await i18n.changeLocale('vi');

    expect(i18n.translate('ra.action.add')).toBe('Add');
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain('failed to load');

    await i18n.changeLocale('vi');

    expect(load).toHaveBeenCalledTimes(2);
    expect(i18n.translate('ra.action.add')).toBe('Them');
    expect(error).toHaveBeenCalledTimes(1);
  });

  test('a failed lazy initial locale still lets the first render go ahead, in English', async () => {
    const { i18n, error } = startingIn({
      locale: 'vi',
      sources: { vi: () => Promise.reject(new Error('offline')) },
    });

    await Features.loadMessages({ features: [], i18nProvider: i18n });

    expect(i18n.translate('ra.action.add')).toBe('Add');
    expect(error).toHaveBeenCalledTimes(1);
  });

  test('a loader may resolve to an ES module whose default export is the messages', async () => {
    const { i18n, error } = startingIn({
      locale: 'en',
      sources: { vi: () => import('./fixtures/vi-messages') },
    });

    await i18n.changeLocale('vi');

    expect(i18n.translate('ra.action.add')).toBe('Them');
    expect(error).not.toHaveBeenCalled();
  });

  test('a loader that resolves to something that is not messages counts as a failed load', async () => {
    const { i18n, error } = startingIn({
      locale: 'en',
      sources: { vi: () => Promise.resolve('not messages' as unknown as object) },
    });

    await i18n.changeLocale('vi');

    expect(i18n.translate('ra.action.add')).toBe('Add');
    expect(error).toHaveBeenCalledTimes(1);
  });

  test('the features messages stay when a lazy source fails', async () => {
    const reports = Features.define({
      name: 'reports',
      messages: { vi: { reports: { title: 'Bao cao' } } },
    });
    class FeatureProvider extends DefaultI18nProvider {}
    const provider = new FeatureProvider(
      {
        i18nSources: { vi: () => Promise.reject(new Error('down')) },
        languages: [{ locale: 'vi', name: 'Tieng Viet' }],
      },
      [reports],
    );
    spyOn(provider.logger, 'error').mockImplementation(() => undefined);
    const i18n = provider.value(new Container());

    await i18n.changeLocale('vi');

    expect(i18n.translate('reports.title')).toBe('Bao cao');
    expect(i18n.translate('ra.action.add')).toBe('Add');
  });
});
