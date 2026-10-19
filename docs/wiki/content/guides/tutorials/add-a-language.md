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
  englishMessages,
  inject,
  provide,
  vietnameseMessages,
} from '@venizia/ardor';

export const messagesEnglish = {
  ...englishMessages,
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

- `i18nSources`: A dictionary mapping locale codes to translation objects. Defaults to `{ en: englishMessages }`.
- `languages`: An array of available locales and their display labels. Defaults to `[{ locale: 'en', name: 'English' }]`.

Spread `englishMessages` (`packages/admin/src/common/locales/en.ts`) or `vietnameseMessages` (`packages/admin/src/common/locales/vi.ts`) to retain standard react-admin keys (`ra.*`), and group custom translations under a dedicated namespace such as `app` to avoid collisions. When using modular features, `DefaultI18nProvider` merges messages from `Features.define()` before applying `i18nSources`, so application dictionaries override feature labels (see [Features](../../references/features)). See [Configuration](../core-concepts/configuration) for configuration class details.

> [!NOTE]
> `DefaultI18nProvider` sets `allowMissing: true`. If a translation key is missing from the active dictionary, Polyglot outputs the key string instead of throwing an error.

## 2. Translate messages in UI components

Call the `useTranslate` hook from `@venizia/ardor` to read messages inside React components:

```tsx
import { useTranslate, type TUseTranslateFn } from '@venizia/ardor';

export const DashboardHeader = () => {
  const translate: TUseTranslateFn = useTranslate();

  return (
    <div>
      <h1>{translate('app.title')}</h1>
      <p>{translate('app.welcome')}</p>
      <span>{translate('ra.action.save')}</span>
    </div>
  );
};
```

Always assign `useTranslate()` to a local variable typed as `TUseTranslateFn`. In `packages/admin/src/hooks/use-translate.ts`, `useTranslate()` returns the typed function when `useI18nProvider()` resolves, or an identity fallback `(key: any) => any`. Annotating `TUseTranslateFn` enforces type checking on your translation keys.

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

`DefaultI18nProvider.resolveInitialLocale` (`packages/admin/src/providers/i18n.ts`) determines the initial language when the provider is built. It inspects the browser language (`navigator.language`, taking the segment before `-`) and activates it if present in `languages`, falling back to `'en'`. If a configured locale has no matching dictionary in `i18nSources`, `composeMessages` falls back to `englishMessages`.

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
  type TUseTranslateFn,
} from '@venizia/ardor';
import type { CoreLayoutProps } from 'ra-core';

export const AdminLayout = ({ children }: CoreLayoutProps) => {
  useHtmlLang();
  useRequestHeaderLocale();
  return <div className="admin-container">{children}</div>;
};

export const ProductsPage = () => {
  const translate: TUseTranslateFn = useTranslate();

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
