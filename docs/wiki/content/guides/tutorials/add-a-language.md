---
title: Add a Language and Custom Messages
description: Configure custom message bundles, add a second language, type translation keys, and synchronize the active locale with backend requests in ARDOR.
---

# Add a Language and Custom Messages

To add custom messages and support multiple languages in ARDOR, bind `CoreBindings.I18N_PROVIDER_OPTIONS` in an application configuration class and provide `DefaultI18nProvider`.

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultI18nProvider,
  inject,
  provide,
  vietnameseMessages,
} from '@venizia/ardor';

export const messagesEnglish = {
  app: {
    title: 'Acme Admin',
    welcome: 'Welcome back',
    products: { title: 'Products', empty: 'No products found' },
  },
};

export const messagesVietnamese = {
  ...vietnameseMessages,
  app: {
    title: 'Quản trị Acme',
    welcome: 'Chào mừng trở lại',
    products: { title: 'Sản phẩm', empty: 'Không tìm thấy sản phẩm nào' },
  },
};

@configuration()
export class I18nConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {
      i18nSources: { en: messagesEnglish, vi: messagesVietnamese },
      languages: [
        { locale: 'en', name: 'English' },
        { locale: 'vi', name: 'Tiếng Việt' },
      ],
    };
  }

  @provide({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
  i18nProvider() {
    return this.application.instantiate(DefaultI18nProvider).value(this.application);
  }
}
```

## 1. Configure message bundles and provider options

`DefaultI18nProvider` in `packages/admin/src/providers/i18n.ts` wraps `polyglotI18nProvider` from `ra-i18n-polyglot`. It resolves `II18nProviderOptions` (`packages/admin/src/common/types.ts`) bound under `CoreBindings.I18N_PROVIDER_OPTIONS`:

- `i18nSources`: A dictionary mapping locale codes to translation objects, or to loaders (`vi: () => import('./vi')`) that keep a catalogue out of the boot bundle until its locale is used. Defaults to `{ en: englishMessages }`. See [Lazy sources](/references/i18n.md#lazy-sources).
- `languages`: An array of available locales and their display labels. Defaults to `[{ locale: 'en', name: 'English' }]`.
- `fallback`: The locale whose messages sit under every other locale. Defaults to `{ locale: 'en' }`.

A catalogue lists only what it adds or changes. ARDOR's `englishMessages` (`packages/admin/src/common/locales/en.ts`) are always the bottom layer, so the standard react-admin keys (`ra.*`) read in English where a catalogue has no text for them, and a feature that ships only `en` shows its English texts in every language. A key a catalogue lacks falls back to English one key at a time; there is no need to spread `englishMessages` into it. Spread `vietnameseMessages` (`packages/admin/src/common/locales/vi.ts`) to take ARDOR's Vietnamese texts for `ra.*`, and group custom translations under a dedicated namespace such as `app` to avoid collisions. When using modular features, `DefaultI18nProvider` layers the messages of `Features.define()` under `i18nSources`, so application dictionaries override feature labels (see [Features](../../references/features) and [Messages by layer](/references/i18n.md#messages-by-layer)). See [Configuration](../core-concepts/configuration) for configuration class details.

> [!NOTE]
> `DefaultI18nProvider` sets `allowMissing: true`. If a translation key is missing from the active dictionary, Polyglot outputs the key string instead of throwing an error.

## 2. Translate messages in UI components

Call the `useTranslate` hook from `@venizia/ardor` to read messages inside React components:

```tsx
import { useTranslate } from '@venizia/ardor';

export const DashboardHeader = () => {
  const translate = useTranslate();

  return (
    <div>
      <h1>{translate('app.title')}</h1>
      <p>{translate('app.welcome')}</p>
      <span>{translate('ra.action.save')}</span>
    </div>
  );
};
```

`useTranslate()` already returns `TUseTranslateFn`, so a key is checked at compile time without an annotation. With no i18n provider mounted, ra-core's default provider answers.

## 3. Type custom keys with module augmentation

By default, `TUseTranslateKeys` accepts only `TUseTranslateKeysDefault`, computed as `TFullPaths<typeof englishMessages>`. Custom keys such as `'app.title'` cause a TypeScript error unless registered.

Augment `IUseTranslateKeysOverrides` on `@venizia/ardor` using the kernel utility type `TFullPaths`:

```ts
import type { TFullPaths } from '@venizia/ardor';
import { englishMessages } from '@venizia/ardor';

export const appMessages = {
  ...englishMessages,
  app: {
    title: 'Acme Admin',
    welcome: 'Welcome back',
    products: { title: 'Products', empty: 'No products found' },
  },
};

type TAppMessageKeys = TFullPaths<typeof appMessages>;

declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides extends Record<TAppMessageKeys, true> {}
}
```

Always augment `@venizia/ardor` rather than internal packages directly. For details, see [Module augmentation](../../best-practices/module-augmentation).

## 4. Language switcher and initial locale

`DefaultI18nProvider.resolveInitialLocale` (`packages/admin/src/providers/i18n.ts`) determines the initial language when the provider is built. It takes the stored locale, else the first of the browser's languages (`navigator.languages`) that `languages` offers, as the full tag (`pt-BR`) and then as its primary subtag (`pt`), else the first entry of `languages`. An app that offers only Vietnamese therefore starts in Vietnamese. See [Initial locale](/references/i18n.md#initial-locale). If a configured locale has no matching dictionary in `i18nSources`, `composeMessages` shows the fallback messages.

The locale the user picks is stored in `localStorage` (`@app/prefs/locale`) and read first on the next visit, so a reload keeps the language. A sign-out does not remove it. Set `locale: { persist: { use: false } }` in the options to turn it off (see [The chosen locale is kept](/references/i18n.md#the-chosen-locale-is-kept)).

Use `useLocaleState` and `useLocales` from `ra-core` to render a language switcher:

```tsx
import { useLocales, useLocaleState } from 'ra-core';
import type { ChangeEvent } from 'react';

export const LanguageSwitcher = () => {
  const [currentLocale, setLocale] = useLocaleState();
  const locales = useLocales();

  const handleLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value);
  };

  return (
    <label>
      <span>Language: </span>
      <select value={currentLocale} onChange={handleLocaleChange} aria-label="Select language">
        {locales.map((item) => (
          <option key={item.locale} value={item.locale}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
};
```

## 5. Synchronize locale with network requests and browser document

Three hooks synchronize locale changes across the application:

- `useRequestHeaderLocale(options?)` (`packages/admin/src/hooks/use-request-header-locale.ts`): Updates HTTP headers on the network service of `DefaultRestDataProvider` (`CoreBindings.DEFAULT_REST_DATA_PROVIDER`). By default, it sets the `x-locale` header (`HeaderConstants.X_LOCALE`). Pass `{ key: 'accept-language' }` to use a different header.
- `useHtmlLang()` (`packages/admin/src/hooks/use-html-lang.ts`): Sets `document.documentElement.lang` to the active locale string for screen readers.
- `useDocumentTitle(options)` (`packages/admin/src/hooks/use-document-title.ts`): Sets `document.title` by joining `title` segments with `appTitle` using `separator` (default `' · '`). Options include `title`, `appTitle`, `separator`, and `enabled` (default `true`). On unmount, it restores the previous title unless a newer title was set.

Place `useHtmlLang` and `useRequestHeaderLocale` in a root layout component, and use `useDocumentTitle` in screen components. Pass the layout component to the `layout` prop of `ArdorApplication` (see [Application](../core-concepts/application)):

```tsx
import {
  useDocumentTitle,
  useHtmlLang,
  useRequestHeaderLocale,
  useTranslate,
} from '@venizia/ardor';
import type { CoreLayoutProps } from 'ra-core';

export const AdminLayout = ({ children }: CoreLayoutProps) => {
  useHtmlLang();
  useRequestHeaderLocale();
  return <div className="admin-container">{children}</div>;
};

export const ProductsPage = () => {
  const translate = useTranslate();

  useDocumentTitle({
    title: translate('app.products.title'),
    appTitle: translate('app.title'),
    separator: ' - ',
  });

  return (
    <div>
      <h2>{translate('app.products.title')}</h2>
      <p>{translate('app.products.empty')}</p>
    </div>
  );
};
```

## Related

- [Configuration](../core-concepts/configuration) - Application configuration and provider bindings
- [Internationalization reference](../../references/i18n) - `DefaultI18nProvider` options and locale resolution
- [Module augmentation](../../best-practices/module-augmentation) - TypeScript interface augmentation patterns
- [Hooks reference](../../references/hooks) - Complete reference of ARDOR React hooks
