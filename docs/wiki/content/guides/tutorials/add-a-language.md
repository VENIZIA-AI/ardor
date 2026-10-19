---
title: Add a Language and Custom Messages
description: Configure custom message bundles, add a second language, type translation keys, and synchronize the active locale with backend requests in ARDOR.
---

# Add a Language and Custom Messages

To add custom messages and support multiple languages in ARDOR, you configure internationalization provider options (`CoreBindings.I18N_PROVIDER_OPTIONS`) in an application configuration class. ARDOR provides pre-translated message bundles for react-admin: `englishMessages` and `vietnameseMessages`. You extend these bundles with your own application message trees, register the available languages, type your keys using TypeScript module augmentation, and synchronize the active locale with HTTP request headers and document metadata.

The first step is declaring your application messages and binding the internationalization provider options:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultI18nProvider,
  englishMessages,
  inject,
  provide,
} from '@venizia/ardor';

export const messagesEnglish = {
  ...englishMessages,
  app: {
    title: 'Acme Admin',
    welcome: 'Welcome back',
    products: {
      title: 'Products',
      empty: 'No products found',
    },
  },
};

@configuration()
export class SingleLanguageConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {
      i18nSources: {
        en: messagesEnglish,
      },
      languages: [{ locale: 'en', name: 'English' }],
    };
  }

  @provide({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
  i18nProvider() {
    return this.application.instantiate(DefaultI18nProvider).value(this.application);
  }
}
```

## 1. Configure message bundles and provider options

ARDOR provides `DefaultI18nProvider` in `packages/admin/src/providers/i18n.ts`, which wraps `polyglotI18nProvider` from `ra-i18n-polyglot`. It resolves configuration options bound under `CoreBindings.I18N_PROVIDER_OPTIONS` in the container.

The options object implements `II18nProviderOptions` from `packages/admin/src/common/types.ts`:

- `i18nSources`: A dictionary mapping locale codes to translation objects. Defaults to `{ en: englishMessages }`.
- `languages`: An array of available locales and their display labels. Defaults to `[{ locale: 'en', name: 'English' }]`.

When defining application messages, always spread `englishMessages` from `packages/admin/src/common/locales/en.ts`. This ensures that all standard react-admin keys (`ra.*`) remain populated. Group your custom translations under a dedicated top-level namespace such as `app` so they do not collide with framework keys.

The configuration class uses `@configuration()` and `@provide({ key })` to declare container bindings. During application startup, `start()` binds each provided method as a lazy singleton. See [Configuration](../core-concepts/configuration) for details on configuration classes.

> [!NOTE]
> `DefaultI18nProvider` allows missing translation keys. If a requested key is not present in the active dictionary, Polyglot outputs the key string itself rather than throwing an error.

## 2. Translate messages in UI components

To retrieve translated messages inside React components, call the `useTranslate` hook from `@venizia/ardor`.

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

Always assign `useTranslate()` to a local variable typed as `TUseTranslateFn`. In `packages/admin/src/hooks/use-translate.ts`, `useTranslate()` returns the typed function when `useI18nProvider()` returns a provider, otherwise an identity function `(key: any) => any`. Explicitly annotating `translate: TUseTranslateFn` enforces type checking and prevents the fallback from widening your translation keys to `any`.

## 3. Type custom keys with module augmentation

Out of the box, `TUseTranslateKeys` accepts only `TUseTranslateKeysDefault`, which is computed as `TFullPaths<typeof englishMessages>`. If you pass a custom key such as `'app.title'`, TypeScript raises a compilation error because `'app.title'` is not part of the default react-admin dictionary.

To teach TypeScript your application keys, augment the empty `IUseTranslateKeysOverrides` interface exported by `@venizia/ardor`. The kernel utility type `TFullPaths` recursively computes all dotted paths of your nested message object:

```ts
import type { TFullPaths } from '@venizia/ardor';
import { englishMessages } from '@venizia/ardor';

export const appMessages = {
  ...englishMessages,
  app: {
    title: 'Acme Admin',
    welcome: 'Welcome back',
    products: {
      title: 'Products',
      empty: 'No products found',
    },
  },
};

type TAppMessageKeys = TFullPaths<typeof appMessages>;

declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides extends Record<TAppMessageKeys, true> {}
}
```

Always augment the umbrella package `@venizia/ardor`, rather than `@venizia/ardor-admin` directly. Augmenting `@venizia/ardor` ensures that non-hoisting package managers resolve the module correctly. For details on structuring declaration files and preventing type widening, see [Module augmentation](../../best-practices/module-augmentation).

## 4. Add a second language and a language switcher

ARDOR includes complete Vietnamese translations for react-admin in `packages/admin/src/common/locales/vi.ts`, exported as `vietnameseMessages`.

To add Vietnamese:

1. Create a Vietnamese message bundle spreading `vietnameseMessages`, and add corresponding Vietnamese translations for your `app` keys.
2. Register the `vi` locale in `i18nSources` and add `{ locale: 'vi', name: 'Tiếng Việt' }` to the `languages` array.

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
    products: {
      title: 'Products',
      empty: 'No products found',
    },
  },
};

export const messagesVietnamese = {
  ...vietnameseMessages,
  app: {
    title: 'Quản trị Acme',
    welcome: 'Chào mừng trở lại',
    products: {
      title: 'Sản phẩm',
      empty: 'Không tìm thấy sản phẩm nào',
    },
  },
};

@configuration()
export class MultiLanguageConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {
      i18nSources: {
        en: messagesEnglish,
        vi: messagesVietnamese,
      },
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

When the application boots, `DefaultI18nProvider.resolveInitialLocale` (`packages/admin/src/providers/i18n.ts`) determines the initial language when the provider is built. It inspects the browser language (`navigator.language`, taking the first segment before `-`) and activates it if it is included in the configured `languages` array, falling back to `'en'` otherwise. If the user selects a configured locale that has no matching entry in `i18nSources`, `composeMessages` falls back to `englishMessages`.

To let users switch languages, use `useLocaleState` and `useLocales` from `ra-core`. `useLocales()` returns the configured `languages` array, and `useLocaleState()` returns the current locale string along with a setter:

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

Switching the locale in the UI requires updating outgoing HTTP requests and DOM document properties. ARDOR provides three hooks for this synchronization:

- `useRequestHeaderLocale(options?)` (`packages/admin/src/hooks/use-request-header-locale.ts`): Listens to `useLocaleState()` and updates the HTTP headers on the network service of `DefaultRestDataProvider` (`CoreBindings.DEFAULT_REST_DATA_PROVIDER`). By default, it sets the `x-locale` header (`HeaderConstants.X_LOCALE`). To send a different header, pass `{ key: 'accept-language' }`.
- `useHtmlLang()` (`packages/admin/src/hooks/use-html-lang.ts`): Synchronizes `document.documentElement.lang` with the active locale string whenever it changes. This ensures screen readers adopt the correct language voice.
- `useDocumentTitle(options)` (`packages/admin/src/hooks/use-document-title.ts`): Updates `document.title` by joining `title` segments with `appTitle` using a `separator` (default `' · '`). Its options are `title` (a string or an array of segments; `false`, `null`, and `undefined` are dropped), `appTitle`, `separator` (default `' · '`), and `enabled` (default `true`). On unmount, it restores the previous title only if nobody wrote a newer one.

Place `useHtmlLang` and `useRequestHeaderLocale` in a root layout component that renders inside the application context. Call `useDocumentTitle` inside individual screen components:

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
  // Synchronizes document.documentElement.lang with the active locale
  useHtmlLang();

  // Sends the current locale in the x-locale HTTP header on REST requests
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

Wire `AdminLayout` into `ArdorApplication` through its `layout` prop. `ArdorApplication` forwards extra props to react-admin's `CoreAdmin`. ra-core's `CoreAdmin` takes a `layout` prop. The default layout renders `children` directly; passing `AdminLayout` wraps every screen in your locale synchronizers:

```tsx
import { configureStore } from '@reduxjs/toolkit';
import {
  ArdorApplication,
  BaseArdorApplication,
  type IApplicationInfo,
} from '@venizia/ardor';
import type { CoreLayoutProps } from 'ra-core';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

declare const AdminLayout: ComponentType<CoreLayoutProps>;
declare const ProductsPage: ComponentType;

class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return {
      name: 'multi-language-admin',
      version: '1.0.0',
      description: 'Multi-language administrative application',
    };
  }

  bindContext(): void {}
}

const application = new Application();
const store = configureStore({
  reducer: { admin: (state: { ready: boolean } = { ready: true }) => state },
});

await application.start();

createRoot(document.getElementById('root')!).render(
  <ArdorApplication
    container={application}
    reduxStore={store}
    suspense={<p>Loading...</p>}
    layout={AdminLayout}
    resources={[{ name: 'products', list: ProductsPage }]}
  />,
);
```

## 6. Feature message bundles

When structuring applications into modular feature packages, features define their own messages or message loaders under the `messages` property of `Features.define()`.

`DefaultI18nProvider` merges messages from all mounted features before applying the application dictionary from `i18nSources`. This hierarchy allows the application to override or relabel terms provided by features. For details on defining and mounting features, see [Features](../../references/features).

## Related

- [Application](../../references/application) - Application container lifecycle and startup order
- [Configuration](../core-concepts/configuration) - `@configuration` classes and `@provide` methods
- [Internationalization reference](../../references/i18n) - `DefaultI18nProvider` options and initial locale resolution
- [Module augmentation](../../best-practices/module-augmentation) - TypeScript interface augmentation patterns
- [Hooks reference](../../references/hooks) - Complete reference of ARDOR React hooks
- [REST data provider](../../references/data-provider) - Network service and HTTP header management
- [Features](../../references/features) - Modular feature packages and message loading
