import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { Container } from '@venizia/ignis-inversion';

import { Features } from '@/features/feature';
import { FeatureMessagesHelper } from '@/helpers/feature-messages';
import { DefaultI18nProvider } from '@/providers/i18n';
import { RejectionHelper } from '@venizia/dev-configs/testing';

beforeEach(() => {
  localStorage.clear();
});

const inventory = Features.define({
  name: 'inventory',
  messages: { en: { inventory: { title: 'Stock', unit: 'Unit' } } },
});

const commerce = Features.define({
  name: 'commerce',
  messages: {
    en: { commerce: { title: 'Orders' } },
    vi: () => Promise.resolve({ commerce: { title: 'Don hang' } }),
  },
});

describe('FeatureMessagesHelper', () => {
  test('merges the bundles every feature has for a locale', async () => {
    const messages = new FeatureMessagesHelper({ features: [inventory, commerce] });

    const result = await messages.read({ locale: 'en' });
    expect(result).toEqual({
      inventory: { title: 'Stock', unit: 'Unit' },
      commerce: { title: 'Orders' },
    });
  });

  // A silent "later wins" is a wrong label nobody notices.
  test('throws on a key two features both define, naming both and the key', async () => {
    const shadow = Features.define({
      name: 'shadow',
      messages: { en: { inventory: { title: 'X' } } },
    });
    const messages = new FeatureMessagesHelper({ features: [inventory, shadow] });

    const result = await RejectionHelper.rejectionOf({ task: messages.read({ locale: 'en' }) });
    expect(result).toMatchObject({
      message: expect.stringContaining(
        "[features] Message 'inventory.title' (en) is defined by both 'inventory' and 'shadow'",
      ),
    });
    expect(() => messages.readNow({ locale: 'en' })).toThrow(
      "[features] Message 'inventory.title' (en) is defined by both 'inventory' and 'shadow'",
    );
  });

  test('loads a lazy bundle once, and readNow leaves it out until then', async () => {
    const loader = mock(() => Promise.resolve({ commerce: { title: 'Don hang' } }));
    const messages = new FeatureMessagesHelper({
      features: [Features.define({ name: 'commerce', messages: { vi: loader } })],
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
    expect(FeatureMessagesHelper.hasLoader({ features: [inventory, commerce], locale: 'vi' })).toBe(
      true,
    );
    expect(FeatureMessagesHelper.hasLoader({ features: [inventory, commerce], locale: 'en' })).toBe(
      false,
    );
  });
});

describe('DefaultI18nProvider with features', () => {
  const createI18n = (opts: { i18nSources?: Record<string, object> }) => {
    return new DefaultI18nProvider(
      {
        ...(opts.i18nSources ? { i18nSources: opts.i18nSources } : {}),
        languages: [
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

describe('a feature loader that resolves to an ES module', () => {
  const orders = Features.define({
    name: 'orders',
    messages: { vi: () => import('../features/fixtures/orders-vi') },
  });

  test('gives the keys of its default export, unprefixed', async () => {
    const messages = new FeatureMessagesHelper({ features: [orders] });

    const result2 = await messages.read({ locale: 'vi' });
    expect(result2).toEqual({ orders: { title: 'Don hang' } });
  });

  test('reaches the provider as the same unprefixed keys', async () => {
    const i18n = new DefaultI18nProvider({ languages: [{ locale: 'vi', name: 'Tieng Viet' }] }, [
      orders,
    ]).value(new Container());

    await i18n.changeLocale('vi');

    expect(i18n.translate('orders.title')).toBe('Don hang');
  });

  test('a loader that resolves to something that is not messages is a failed load', async () => {
    const broken = Features.define({
      name: 'broken',
      messages: { vi: () => import('../features/fixtures/not-messages') },
    });
    const messages = new FeatureMessagesHelper({ features: [broken] });

    const result = await RejectionHelper.rejectionOf({ task: messages.read({ locale: 'vi' }) });

    expect(result).toMatchObject({ message: expect.stringContaining("loader of 'broken'") });
  });
});

describe('loaders that are called while another call is still waiting', () => {
  const gate = () => {
    let open: (messages: object) => void = () => {};

    const promise = new Promise<object>((resolve) => {
      open = resolve;
    });

    return { promise, open };
  };

  test('two reads of a feature locale before the loader settles call it once', async () => {
    const { promise, open } = gate();
    const loader = mock(() => promise);
    const messages = new FeatureMessagesHelper({
      features: [Features.define({ name: 'commerce', messages: { vi: loader } })],
    });

    const first = messages.read({ locale: 'vi' });
    const second = messages.read({ locale: 'vi' });
    open({ commerce: { title: 'Don hang' } });

    const result = await first;
    expect(result).toEqual({ commerce: { title: 'Don hang' } });
    const result2 = await second;
    expect(result2).toEqual({ commerce: { title: 'Don hang' } });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('a loader that failed is called again, and one that delivered is not', async () => {
    const delivered = mock(() => Promise.resolve({ a: 'A' }));
    const flaky = mock<() => Promise<object>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ b: 'B' });
    const messages = new FeatureMessagesHelper({
      features: [
        Features.define({ name: 'a', messages: { vi: delivered } }),
        Features.define({ name: 'b', messages: { vi: flaky } }),
      ],
    });

    const failure = await RejectionHelper.rejectionOf({ task: messages.read({ locale: 'vi' }) });
    expect(failure).toMatchObject({ message: 'down' });

    const result3 = await messages.read({ locale: 'vi' });
    expect(result3).toEqual({ a: 'A', b: 'B' });
    expect(delivered).toHaveBeenCalledTimes(1);
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  test('two changeLocale calls before an application loader settles call it once', async () => {
    const { promise, open } = gate();
    const load = mock(() => promise);
    const i18n = new DefaultI18nProvider({
      i18nSources: { vi: load },
      languages: [
        { locale: 'en', name: 'English' },
        { locale: 'vi', name: 'Tieng Viet' },
      ],
    }).value(new Container());

    const first = i18n.changeLocale('vi');
    const second = i18n.changeLocale('vi');
    open({ ra: { action: { add: 'Them' } } });
    await Promise.all([first, second]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(i18n.translate('ra.action.add')).toBe('Them');
  });
});
