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
      listLanguages: [{ locale: 'vi', name: 'Tieng Viet' }],
    });
    const i18n = provider.value(container);

    await i18n.changeLocale('vi');
    expect(i18n.translate('ra.action.add')).toBe('Them');

    await i18n.changeLocale('fr');
    expect(i18n.translate('ra.action.add')).toBe('Add');
  });

  test('returns default listLanguages when options omit listLanguages', () => {
    const container = new Container();
    const provider = new DefaultI18nProvider({});
    const i18n = provider.value(container);

    expect(i18n.getLocales?.()).toEqual([{ locale: 'en', name: 'English' }]);
  });

  test('returns listLanguages matching configured options', () => {
    const container = new Container();
    const listLanguages = [{ locale: 'vi', name: 'Tieng Viet' }];
    const provider = new DefaultI18nProvider({
      listLanguages,
    });
    const i18n = provider.value(container);

    expect(i18n.getLocales?.()).toEqual(listLanguages);
  });
});
