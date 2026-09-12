---
title: 5-minute quickstart
description: From a new Vite + React project to a running ARDOR admin - install, decorator flags, an Application class that binds the three default providers and one service, ArdorApplication at the root, and a list that resolves the service from the container.
---

# 5-Minute Quickstart

Build a working ARDOR admin: one application class, the three default providers, one service, and one resource page that resolves that service through a hook.

**Time to complete:** ~5 minutes

> **Prerequisite:** Bun 1.3 or later, and a REST API to point the data provider at.

## 1. Create the project

Scaffold a Vite + React + TypeScript project and install ARDOR with its peers:

```bash
bun create vite my-admin --template react-ts
cd my-admin
bun install
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter ra-core react react-dom react-redux @reduxjs/toolkit react-router-dom @tanstack/react-query reflect-metadata
```

`@venizia/ardor` is the umbrella package. It re-exports `@venizia/ardor-kernel`, `@venizia/ardor-react`, and `@venizia/ardor-admin`, so the application needs one import path.

## 2. Configure TypeScript for decorators

ARDOR's container is `@venizia/ignis-inversion`, which relies on TypeScript's legacy decorators and their metadata. Set the two flags directly in the `tsconfig` that includes `src` (`tsconfig.app.json` in a Vite scaffold). Put them inline, not behind an `extends` chain, as IGNIS requires.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

## 3. Write the application

The application lives in one file, `src/main.tsx`. It holds the container side - a service and the application class - and the React side - a resource page and the bootstrap that mounts the root component.

Replace `src/main.tsx` with:

```tsxx
import 'reflect-metadata';

import { configureStore } from '@reduxjs/toolkit';
import {
  ArdorApplication,
  BaseApiService,
  BaseArdorApplication,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  useInjectable,
  useTranslate,
  vietnameseMessages,
  type IApplicationInfo,
} from '@venizia/ardor';
import { createRoot } from 'react-dom/client';

// 1. A service. `this.service(ProductApi)` binds it under `services.ProductApi`.
export class ProductApi extends BaseApiService {
  constructor() {
    super({ scope: 'ProductApi', resource: 'products' });
  }

  getResource(): string {
    return this.resource;
  }
}

// 2. Teach `useInjectable` the key. Without this augmentation the string
// 'services.ProductApi' is not an accepted key and the page does not compile.
declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides {
    'services.ProductApi': unknown;
  }
}

// 3. The application: an IoC container that declares what it binds.
export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'my-admin', version: '1.0.0', description: 'My admin' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: 'http://localhost:3000/api',
      // Paths reached before a token exists. Anything not listed here (or matched by
      // `noAuthPathRegex`) is sent with an Authorization header and fails without one.
      noAuthPaths: ['/auth/login'],
      authRecovery: { refreshTokenPath: '/auth/refresh' },
    });
    this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({
      paths: { signIn: '/auth/login' },
      endpoints: { afterLogin: '/products' },
    });
    this.bind({ key: CoreBindings.I18N_PROVIDER_OPTIONS }).toValue({
      i18nSources: { en: englishMessages, vi: vietnameseMessages },
      listLanguages: [
        { locale: 'en', name: 'English' },
        { locale: 'vi', name: 'Tiếng Việt' },
      ],
    });

    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(DefaultRestDataProvider);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toClass(DefaultAuthService);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(DefaultAuthProvider);
    this.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toProvider(DefaultI18nProvider);

    this.service(ProductApi);
  }
}

// 4. A resource page. The hooks resolve from the container that ArdorApplication provides.
const ProductList = () => {
  const productApi = useInjectable<ProductApi>({ key: 'services.ProductApi' });
  const translate = useTranslate();

  return (
    <section>
      <h1>{productApi.getResource()}</h1>
      <button type="button">{translate('ra.action.refresh')}</button>
    </section>
  );
};

// 5. Start the container, then hand it to the root component.
const store = configureStore({ reducer: (state = {}) => state });

async function bootstrap() {
  const application = new Application();
  await application.start();

  createRoot(document.getElementById('root')!).render(
    <ArdorApplication
      container={application}
      reduxStore={store}
      suspense={<p>Loading</p>}
      resources={[{ name: 'products', list: ProductList }]}
    />,
  );
}

void bootstrap();
```

What each part does:

- `import 'reflect-metadata'` must be the first import of `main.tsx`. It has to run once, before the application class is defined. If you later move the container side into its own file, keep that import at the top of the file that defines the application class.
- `ProductApi` extends `BaseApiService`, which takes `{ scope, resource }` and stores `resource` on the instance. `this.service(ProductApi)` binds the class under the key `services.ProductApi` (the `services` scope plus the class name) as a singleton: one instance per application.
- The `declare module '@venizia/ardor-react'` block adds `services.ProductApi` to `IUseInjectableKeysOverrides`. `useInjectable` only accepts keys that the framework binds or that you declare this way. Declare it in the file that defines the service, next to the class.
- `Application` extends `BaseArdorApplication`. Two methods are abstract: `getAppInfo()` returns the app's name, version and description; `bindContext()` declares every binding. Three option values feed the three default providers, and `DefaultAuthService` backs `DefaultAuthProvider`.
- `application.start()` runs `preConfigure()`, which binds the application instance and its info, then calls your `bindContext()`. It then runs `postConfigure()`, which is empty by default.
- `ProductList` calls `useInjectable` with the key that `service()` produced, and `useTranslate` to resolve a message key against the bundles bound to `I18N_PROVIDER_OPTIONS`.
- `ArdorApplication` reads the data provider, auth provider and i18n provider from the container by their `CoreBindings` keys, wraps the tree in the application context, the Redux provider and `React.Suspense`, and renders one react-admin `Resource` per entry in `resources`. Any other prop is passed to `CoreAdmin` as-is.

Replace `url` with the address of your API. In a real project you would read it from an environment variable.

## 4. Run it

Start the dev server:

```bash
bun run dev
```

Open the URL Vite prints (`http://localhost:5173` by default). The admin resolves the three providers from the container and routes the `products` resource to `ProductList`.

## 5. Check the wiring

Two things confirm the container is doing the work:

- The heading reads `products`. That string came from the `ProductApi` singleton, resolved by key from the container, not from props.
- The button label comes from `translate`, which resolves the key through the i18n provider bound in `bindContext()`.

If `useInjectable` throws for `services.ProductApi`, check the key: it is built from the class name, so renaming `ProductApi` changes the key. If TypeScript rejects the key instead, the `IUseInjectableKeysOverrides` augmentation is missing or spells the key differently.

## What you built

A running ARDOR admin: one application class that binds REST, auth and i18n options, the three default providers, one service registered with `service()`, and one resource page that resolves that service through `useInjectable` - in one file.

## Next steps

- Teach TypeScript your binding and message keys: [Module augmentation](../../best-practices/module-augmentation)
- Every key the framework binds and reads: [Binding keys](../../references/binding-keys)
- The application lifecycle and `ArdorApplication` props: [Application](../../references/application)
- What the REST data provider does with `url`, `noAuthPaths` and `authRecovery`: [Data provider](../../references/data-provider)
- Sign-in paths and redirects: [Auth provider](../../references/auth-provider)
- Message bundles and languages: [i18n](../../references/i18n)
- The full hook list: [Hooks](../../references/hooks)
- Coming from `@minimaltech/ra-core-infra`: [Migration guide](../migration/from-ra-core-infra)
