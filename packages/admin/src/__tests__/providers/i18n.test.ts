import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { LoggerFactory } from '@venizia/ignis-helpers/core';
import { Container } from '@venizia/ignis-inversion';

import { CoreBindings, LocalStorageKeys } from '@venizia/ardor-kernel';

import type { TI18nSource } from '@/common';
import { englishMessages } from '@/common/locales';
import { Features, type TFeature } from '@/features';
import { DefaultI18nProvider } from '@/providers/i18n';

beforeEach(() => {
  localStorage.clear();
});

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
    const warn = spyOn(provider.logger, 'warn').mockImplementation(() => undefined);

    try {
      expect(i18n.translate('missing.action.key')).toBe('missing.action.key');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[translate] Missing message'),
        'missing.action.key',
        'en',
      );
    } finally {
      warn.mockRestore();
    }
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

  test.each([
    [
      'an array over a message',
      { ra: { action: { add: ['a', 'b'] } } },
      'ra.action.add',
      'Add',
      'ra.action.add',
    ],
    [
      'a number over a message',
      { ra: { action: { add: 7 } } },
      'ra.action.add',
      'Add',
      'ra.action.add',
    ],
    [
      'null over a message',
      { ra: { action: { add: null } } },
      'ra.action.add',
      'Add',
      'ra.action.add',
    ],
    [
      'an object over a message',
      { ra: { action: { add: { one: 'x' } } } },
      'ra.action.add',
      'Add',
      'ra.action.add',
    ],
    ['a message over a group', { ra: { action: 'gone' } }, 'ra.action.add', 'Add', 'ra.action'],
    ['an array under a new key', { app: { list: ['a'] } }, 'app.list', 'app.list', 'app.list'],
    ['a number under a new key', { app: { count: 3 } }, 'app.count', 'app.count', 'app.count'],
  ])(
    'a source of the wrong shape (%s) does not reach the messages',
    (_name, wrong, key, text, left) => {
      const warn = spyOn(
        LoggerFactory.getLogger(['DefaultI18nProvider']),
        'warn',
      ).mockImplementation(() => undefined);

      try {
        const i18n = new DefaultI18nProvider({ i18nSources: { en: wrong } }).value(new Container());

        expect(i18n.translate(key, { _: text === key ? key : 'missing' })).toBe(text);
        expect(warn).toHaveBeenCalledWith(
          '[composeMessages] Messages of the wrong shape are left out of %s | keys: %s',
          'i18nSources (en)',
          left,
        );
      } finally {
        warn.mockRestore();
      }
    },
  );

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
  // A logger is shared by scope, so a spy on it is taken off after each test.
  const spies: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of spies.splice(0)) {
      spy.mockRestore();
    }
  });

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
    spies.push(error);

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
    spies.push(spyOn(provider.logger, 'error').mockImplementation(() => undefined));
    const i18n = provider.value(new Container());

    await i18n.changeLocale('vi');

    expect(i18n.translate('reports.title')).toBe('Bao cao');
    expect(i18n.translate('ra.action.add')).toBe('Add');
  });
});

describe('DefaultI18nProvider English fallback', () => {
  const languages = [
    { locale: 'en', name: 'English' },
    { locale: 'vi', name: 'Tieng Viet' },
  ];

  test('a partial catalogue keeps the framework English for the keys it lacks', async () => {
    const i18n = new DefaultI18nProvider({
      i18nSources: { vi: { app: { title: 'Quan tri' } } },
      languages,
    }).value(new Container());

    await i18n.changeLocale('vi');

    expect(i18n.translate('app.title')).toBe('Quan tri');
    expect(i18n.translate('ra.action.save')).toBe('Save');
  });

  test('a feature that ships only English shows its English text in another locale', async () => {
    const reports = Features.define({
      name: 'reports',
      messages: { en: { reports: { title: 'Reports' } } },
    });
    const i18n = new DefaultI18nProvider(
      { i18nSources: { vi: { app: { title: 'Quan tri' } } }, languages },
      [reports],
    ).value(new Container());

    await i18n.changeLocale('vi');

    expect(i18n.translate('reports.title')).toBe('Reports');
  });

  test('layers English, the features, then the application, the chosen locale over English at each step', async () => {
    const reports = Features.define({
      name: 'reports',
      messages: {
        en: { a: 'feature en', b: 'feature en', c: 'feature en' },
        vi: { b: 'feature vi', c: 'feature vi' },
      },
    });
    const i18n = new DefaultI18nProvider(
      {
        i18nSources: {
          en: { c: 'app en', d: 'app en' },
          vi: { d: 'app vi' },
        },
        languages,
      },
      [reports],
    ).value(new Container());

    await i18n.changeLocale('vi');

    expect(i18n.translate('a')).toBe('feature en');
    expect(i18n.translate('b')).toBe('feature vi');
    expect(i18n.translate('c')).toBe('app en');
    expect(i18n.translate('d')).toBe('app vi');
  });

  test('an application that spreads englishMessages into its own catalogue still works', async () => {
    const i18n = new DefaultI18nProvider({
      i18nSources: { vi: { ...englishMessages, app: { title: 'Quan tri' } } },
      languages,
    }).value(new Container());

    await i18n.changeLocale('vi');

    expect(i18n.translate('ra.action.save')).toBe('Save');
    expect(i18n.translate('app.title')).toBe('Quan tri');
  });

  test('fallback.locale picks the locale layered underneath', async () => {
    const i18n = new DefaultI18nProvider({
      i18nSources: { vi: { app: { onlyVi: 'Chi co' } }, en: { app: { onlyEn: 'Only' } } },
      languages,
      fallback: { locale: 'vi' },
    }).value(new Container());

    await i18n.changeLocale('en');

    expect(i18n.translate('app.onlyVi')).toBe('Chi co');
    expect(i18n.translate('app.onlyEn')).toBe('Only');
    expect(i18n.translate('ra.action.save')).toBe('Save');
  });

  test('a lazy fallback locale is awaited before the first render', async () => {
    const english = { app: { title: 'Admin' } };
    const load = mock(() => Promise.resolve(english));
    class ViProvider extends DefaultI18nProvider {
      protected override resolveInitialLocale(): string {
        return 'vi';
      }
    }
    const i18n = new ViProvider({
      i18nSources: { en: load, vi: { app: { other: 'Khac' } } },
      languages,
    }).value(new Container());

    expect(Features.hasPendingMessages({ features: [], i18nProvider: i18n })).toBe(true);

    await Features.loadMessages({ features: [], i18nProvider: i18n });

    expect(i18n.translate('app.title')).toBe('Admin');
    expect(i18n.translate('app.other')).toBe('Khac');
    expect(Features.hasPendingMessages({ features: [], i18nProvider: i18n })).toBe(false);
  });
});

describe('DefaultI18nProvider persisted locale', () => {
  const languages = [
    { locale: 'en', name: 'English' },
    { locale: 'vi', name: 'Tieng Viet' },
  ];
  const key = LocalStorageKeys.scoped().locale;

  test('changeLocale stores the choice under the preferences prefix', async () => {
    const i18n = new DefaultI18nProvider({ languages }).value(new Container());

    await i18n.changeLocale('vi');

    expect(key).toBe('@app/prefs/locale');
    expect(localStorage.getItem(key)).toBe('vi');
  });

  test('the next provider starts in the stored locale', async () => {
    const defaultI18nProvider = new DefaultI18nProvider({ languages }).value(new Container());
    await defaultI18nProvider.changeLocale('vi');

    const next = new DefaultI18nProvider({ languages }).value(new Container());

    expect(next.getLocale()).toBe('vi');
  });

  test('a stored locale that is not offered is ignored', () => {
    localStorage.setItem(key, 'fr');

    const i18n = new DefaultI18nProvider({ languages }).value(new Container());

    expect(i18n.getLocale()).toBe('en');
  });

  test('a locale that is not offered is not stored', async () => {
    const i18n = new DefaultI18nProvider({ languages }).value(new Container());

    await i18n.changeLocale('fr');

    expect(localStorage.getItem(key)).toBeNull();
  });

  test('choosing the locale already shown stores nothing', async () => {
    const i18n = new DefaultI18nProvider({ languages }).value(new Container());

    await i18n.changeLocale('en');

    expect(localStorage.getItem(key)).toBeNull();
  });

  test('locale.persist.use false neither stores nor reads', async () => {
    localStorage.setItem(key, 'vi');
    const i18n = new DefaultI18nProvider({
      languages,
      locale: { persist: { use: false } },
    }).value(new Container());

    expect(i18n.getLocale()).toBe('en');

    localStorage.clear();
    await i18n.changeLocale('vi');

    expect(localStorage.getItem(key)).toBeNull();
  });

  test('the application id scopes the key', async () => {
    const container = new Container();
    container
      .bind({ key: CoreBindings.APPLICATION_INFO })
      .toValue({ name: 'shop', version: '1', description: '', id: 'shop' });

    const defaultI18nProvider2 = new DefaultI18nProvider({ languages }).value(container);
    await defaultI18nProvider2.changeLocale('vi');

    expect(localStorage.getItem('@app/prefs/shop/locale')).toBe('vi');
    expect(localStorage.getItem(key)).toBeNull();
  });

  test('without a browser storage it neither throws nor stores', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });

    try {
      const i18n = new DefaultI18nProvider({ languages }).value(new Container());
      await i18n.changeLocale('vi');

      expect(i18n.getLocale()).toBe('vi');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    }

    expect(localStorage.getItem(key)).toBeNull();
  });
});

describe('DefaultI18nProvider initial locale detection', () => {
  const setNavigator = (opts: { language: string; languages?: Array<string> }) => {
    Object.defineProperty(navigator, 'language', { value: opts.language, configurable: true });
    Object.defineProperty(navigator, 'languages', {
      value: opts.languages ?? [opts.language],
      configurable: true,
    });
  };

  const original = { language: navigator.language, languages: [...navigator.languages] };

  afterEach(() => {
    setNavigator(original);
  });

  const initialOf = (opts: {
    browser: string;
    offered: Array<string>;
    languages?: Array<string>;
  }) => {
    setNavigator({ language: opts.browser, languages: opts.languages });

    return new DefaultI18nProvider({
      languages: opts.offered.map((locale) => ({ locale, name: locale })),
    })
      .value(new Container())
      .getLocale();
  };

  const cases: Array<{ browser: string; offered: Array<string>; expected: string }> = [
    { browser: 'fr-FR', offered: ['vi'], expected: 'vi' },
    { browser: 'fr-FR', offered: ['en', 'vi'], expected: 'en' },
    { browser: 'fr-FR', offered: ['vi', 'en'], expected: 'vi' },
    { browser: 'pt-BR', offered: ['pt-BR', 'en'], expected: 'pt-BR' },
    { browser: 'pt-BR', offered: ['en', 'pt'], expected: 'pt' },
    { browser: 'zh-TW', offered: ['zh-CN', 'zh-TW'], expected: 'zh-TW' },
    { browser: 'vi-vn', offered: ['en', 'vi-VN'], expected: 'vi-VN' },
    { browser: 'en-US', offered: ['vi'], expected: 'vi' },
    { browser: 'vi-VN', offered: ['en', 'vi'], expected: 'vi' },
    { browser: 'en-US', offered: [], expected: 'en' },
  ];

  test.each(cases)(
    'the browser $browser with $offered starts in $expected',
    ({ browser, offered, expected }) => {
      expect(initialOf({ browser, offered })).toBe(expected);
    },
  );

  test('a later browser preference is used when the first is not offered', () => {
    expect(
      initialOf({ browser: 'fr-FR', languages: ['fr-FR', 'vi-VN'], offered: ['en', 'vi'] }),
    ).toBe('vi');
  });

  test('a language the browser lists first wins over one it lists later', () => {
    expect(
      initialOf({ browser: 'vi-VN', languages: ['vi-VN', 'en-US'], offered: ['en', 'vi'] }),
    ).toBe('vi');
  });

  test('the stored locale comes before the browser', async () => {
    localStorage.setItem(LocalStorageKeys.scoped().locale, 'en');

    expect(initialOf({ browser: 'vi-VN', offered: ['en', 'vi'] })).toBe('en');
  });

  test('a navigator that has no languages list still gives its language', () => {
    setNavigator({ language: 'vi-VN' });
    Object.defineProperty(navigator, 'languages', { value: undefined, configurable: true });

    const i18n = new DefaultI18nProvider({
      languages: [
        { locale: 'en', name: 'English' },
        { locale: 'vi', name: 'Tieng Viet' },
      ],
    }).value(new Container());

    expect(i18n.getLocale()).toBe('vi');
  });

  test('a navigator that has no language at all falls to the first offered language', () => {
    Object.defineProperty(navigator, 'language', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'languages', { value: undefined, configurable: true });

    const i18n = new DefaultI18nProvider({
      languages: [
        { locale: 'vi', name: 'Tieng Viet' },
        { locale: 'en', name: 'English' },
      ],
    }).value(new Container());

    expect(i18n.getLocale()).toBe('vi');
  });

  test('without a navigator the first offered language is used', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });

    try {
      const i18n = new DefaultI18nProvider({
        languages: [
          { locale: 'vi', name: 'Tieng Viet' },
          { locale: 'en', name: 'English' },
        ],
      }).value(new Container());

      expect(i18n.getLocale()).toBe('vi');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'navigator', descriptor);
      }
    }
  });
});

describe('DefaultI18nProvider failed feature messages', () => {
  const languages = [
    { locale: 'en', name: 'English' },
    { locale: 'vi', name: 'Tieng Viet' },
  ];
  const spies: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of spies.splice(0)) {
      spy.mockRestore();
    }
  });

  const build = (opts: { features: Array<TFeature>; languages?: typeof languages }) => {
    const provider = new DefaultI18nProvider(
      { languages: opts.languages ?? languages },
      opts.features,
    );
    const error = spyOn(provider.logger, 'error').mockImplementation(() => undefined);
    spies.push(error);

    return { error, i18n: provider.value(new Container()) };
  };

  test('a feature loader that fails is logged, the locale shows English, and the next switch tries again', async () => {
    const load = mock<() => Promise<object>>()
      .mockRejectedValueOnce(new Error('chunk is down'))
      .mockResolvedValueOnce({ reports: { title: 'Bao cao' } });
    const reports = Features.define({
      name: 'reports',
      messages: { en: { reports: { title: 'Reports' } }, vi: load },
    });
    const { i18n, error } = build({ features: [reports] });

    await i18n.changeLocale('vi');

    expect(i18n.getLocale()).toBe('vi');
    expect(i18n.translate('reports.title')).toBe('Reports');
    expect(error).toHaveBeenCalledTimes(1);

    await i18n.changeLocale('vi');

    expect(load).toHaveBeenCalledTimes(2);
    expect(i18n.translate('reports.title')).toBe('Bao cao');
    expect(error).toHaveBeenCalledTimes(1);
  });

  test('a key two features define in a locale that is not the initial one throws when the provider is built', () => {
    const first = Features.define({ name: 'first', messages: { vi: { shared: 'A' } } });
    const second = Features.define({ name: 'second', messages: { vi: { shared: 'B' } } });

    expect(() => build({ features: [first, second] })).toThrow(
      "[features] Message 'shared' (vi) is defined by both 'first' and 'second'",
    );
  });

  test('a key two features define in the fallback locale throws when the provider is built, even if it is not offered', () => {
    const first = Features.define({ name: 'first', messages: { en: { shared: 'A' } } });
    const second = Features.define({ name: 'second', messages: { en: { shared: 'B' } } });

    expect(() =>
      build({ features: [first, second], languages: [{ locale: 'vi', name: 'Tieng Viet' }] }),
    ).toThrow("[features] Message 'shared' (en) is defined by both 'first' and 'second'");
  });

  test('a key two features define only once their lazy bundles load is logged and the switch goes ahead', async () => {
    const first = Features.define({
      name: 'first',
      messages: { en: { first: 'F' }, vi: () => Promise.resolve({ shared: 'A' }) },
    });
    const second = Features.define({
      name: 'second',
      messages: { vi: () => Promise.resolve({ shared: 'B' }) },
    });
    const { i18n, error } = build({ features: [first, second] });

    await i18n.changeLocale('vi');

    expect(i18n.getLocale()).toBe('vi');
    expect(i18n.translate('first')).toBe('F');
    expect(String(error.mock.calls[0]?.[0])).toContain('failed to load');
  });

  test('a locale the provider does not offer never makes changeLocale throw or reject', async () => {
    const first = Features.define({ name: 'first', messages: { fr: { shared: 'A' } } });
    const second = Features.define({ name: 'second', messages: { fr: { shared: 'B' } } });
    const { i18n } = build({ features: [first, second] });

    const task = i18n.changeLocale('fr');
    const result = await task;

    expect(result).toBeUndefined();
    expect(i18n.translate('ra.action.save')).toBe('Save');
  });
});

describe('DefaultI18nProvider missing keys', () => {
  const spies: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of spies.splice(0)) {
      spy.mockRestore();
    }
  });

  const build = () => {
    const provider = new DefaultI18nProvider({
      i18nSources: { vi: { app: { title: 'Quan tri' } } },
      languages: [
        { locale: 'en', name: 'English' },
        { locale: 'vi', name: 'Tieng Viet' },
      ],
    });
    const warn = spyOn(provider.logger, 'warn').mockImplementation(() => undefined);
    spies.push(warn);

    return { warn, i18n: provider.value(new Container()) };
  };

  test('a missing key is logged once per locale and still renders as the key', async () => {
    const { i18n, warn } = build();

    expect(i18n.translate('app.nope')).toBe('app.nope');
    expect(i18n.translate('app.nope')).toBe('app.nope');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('Missing');

    await i18n.changeLocale('vi');

    expect(i18n.translate('app.nope')).toBe('app.nope');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  test('a missing key still takes its tokens and plural forms', () => {
    const { i18n, warn } = build();

    expect(i18n.translate('Hello %{name}', { name: 'Ada' })).toBe('Hello Ada');
    expect(
      i18n.translate('%{smart_count} item |||| %{smart_count} items', { ['smart_count']: 2 }),
    ).toBe('2 items');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  test('a missing key takes a number as the plural count, as polyglot does', () => {
    const { i18n } = build();

    expect(i18n.translate('%{smart_count} item |||| %{smart_count} items', 2)).toBe('2 items');
    expect(i18n.translate('%{smart_count} item |||| %{smart_count} items', 1)).toBe('1 item');
  });

  test('a different missing key is logged on its own', () => {
    const { i18n, warn } = build();

    i18n.translate('app.one');
    i18n.translate('app.two');

    expect(warn).toHaveBeenCalledTimes(2);
  });

  test('a key that exists, and a key with a default text, are not reported', () => {
    const { i18n, warn } = build();

    expect(i18n.translate('ra.action.save')).toBe('Save');
    expect(i18n.translate('app.other', { _: 'Hello %{name}', name: 'Ada' })).toBe('Hello Ada');
    expect(warn).not.toHaveBeenCalled();
  });
});
