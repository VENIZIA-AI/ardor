import { describe, expect, mock, test } from 'bun:test';
import { Container } from '@venizia/ignis-inversion';

import { defineFeature } from '@/features/feature';
import { FeatureMessages } from '@/features/messages';
import { DefaultI18nProvider } from '@/providers/i18n';

const inventory = defineFeature({
  name: 'inventory',
  messages: { en: { inventory: { title: 'Stock', unit: 'Unit' } } },
});

const commerce = defineFeature({
  name: 'commerce',
  messages: {
    en: { commerce: { title: 'Orders' } },
    vi: () => Promise.resolve({ commerce: { title: 'Don hang' } }),
  },
});

describe('FeatureMessages', () => {
  test('merges the bundles every feature has for a locale', async () => {
    const messages = new FeatureMessages({ features: [inventory, commerce] });

    expect(await messages.read({ locale: 'en' })).toEqual({
      inventory: { title: 'Stock', unit: 'Unit' },
      commerce: { title: 'Orders' },
    });
  });

  // A silent "later wins" is a wrong label nobody notices.
  test('throws on a key two features both define, naming both and the key', async () => {
    const shadow = defineFeature({
      name: 'shadow',
      messages: { en: { inventory: { title: 'X' } } },
    });
    const messages = new FeatureMessages({ features: [inventory, shadow] });

    await expect(messages.read({ locale: 'en' })).rejects.toThrow(
      "[features] Message 'inventory.title' (en) is defined by both 'inventory' and 'shadow'",
    );
    expect(() => messages.readNow({ locale: 'en' })).toThrow(
      "[features] Message 'inventory.title' (en) is defined by both 'inventory' and 'shadow'",
    );
  });

  test('loads a lazy bundle once, and readNow leaves it out until then', async () => {
    const loader = mock(() => Promise.resolve({ commerce: { title: 'Don hang' } }));
    const messages = new FeatureMessages({
      features: [defineFeature({ name: 'commerce', messages: { vi: loader } })],
    });

    expect(messages.isPending({ locale: 'vi' })).toBe(true);
    expect(messages.readNow({ locale: 'vi' })).toEqual({});

    await messages.read({ locale: 'vi' });
    await messages.read({ locale: 'vi' });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(messages.isPending({ locale: 'vi' })).toBe(false);
    expect(messages.readNow({ locale: 'vi' })).toEqual({ commerce: { title: 'Don hang' } });
  });

  test('says whether any feature loads a locale lazily', () => {
    expect(FeatureMessages.hasLoader({ features: [inventory, commerce], locale: 'vi' })).toBe(true);
    expect(FeatureMessages.hasLoader({ features: [inventory, commerce], locale: 'en' })).toBe(
      false,
    );
  });
});

describe('DefaultI18nProvider with features', () => {
  const createI18n = (opts: { i18nSources?: Record<string, object> }) => {
    return new DefaultI18nProvider(
      {
        ...(opts.i18nSources ? { i18nSources: opts.i18nSources } : {}),
        listLanguages: [
          { locale: 'en', name: 'English' },
          { locale: 'vi', name: 'Tieng Viet' },
        ],
      },
      [inventory, commerce],
    ).value(new Container());
  };

  test("translates a feature's key beside the framework's own", () => {
    const i18n = createI18n({});

    expect(i18n.translate('inventory.title')).toBe('Stock');
    expect(i18n.translate('ra.action.add')).toBe('Add');
  });

  test("lets the application's own sources relabel a feature", () => {
    const i18n = createI18n({ i18nSources: { en: { inventory: { title: 'Warehouse' } } } });

    expect(i18n.translate('inventory.title')).toBe('Warehouse');
    expect(i18n.translate('inventory.unit')).toBe('Unit');
  });

  test('loads a lazy locale on changeLocale', async () => {
    const i18n = createI18n({});

    await i18n.changeLocale('vi');

    expect(i18n.translate('commerce.title')).toBe('Don hang');
  });
});
