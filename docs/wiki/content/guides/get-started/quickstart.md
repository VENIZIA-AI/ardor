---
title: 5-minute quickstart
description: From a new Vite + React project to a running ARDOR admin - install, decorator flags, an Application class that binds the three default providers and one repository, ArdorApplication at the root, and a page that resolves the repository from the container.
---

# 5-Minute Quickstart

Build a working ARDOR admin: one application class, the three default providers, one repository, and one resource page that resolves it through a hook.

**Time to complete:** ~5 minutes

> **Prerequisite:** Bun 1.4 or later, and a REST API to point the data provider at.

## 1. Create the project

Scaffold a Vite + React + TypeScript project and install ARDOR with its peers:

```bash
bun create vite my-admin --template react-ts
cd my-admin
bun install
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-kernel @venizia/ignis-helpers @venizia/ignis-connectors ra-core react react-dom react-redux @reduxjs/toolkit react-router-dom @tanstack/react-query reflect-metadata
```

`@venizia/ardor` is the umbrella package. It re-exports `@venizia/ardor-kernel`, `@venizia/ardor-react`, and `@venizia/ardor-admin`, so the application needs one import path. `@venizia/ignis-connectors` is only for `@venizia/ardor/repository`, which this guide uses.

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

The application lives in one file, `src/main.tsx`. It holds the container side - a repository and the application class - and the React side - a resource page and the bootstrap that mounts the root component.

Replace `src/main.tsx` with:

```tsx
import 'reflect-metadata';

import { configureStore } from '@reduxjs/toolkit';
import {
  ArdorApplication,
  BaseArdorApplication,
  CoreBindings,
  datasource,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  readAuthTokenFromStorage,
  repository,
  RepositoryTypes,
  useRepository,
  useTranslate,
  vietnameseMessages,
  type IApplicationInfo,
} from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface IProduct {
  id: number;
  name: string;
}

// 1. The datasource, and a repository that reads one resource through it. Both are declared, and
//    the application discovers them at start().
@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: 'http://localhost:3000/api', authTokenResolver: readAuthTokenFromStorage });
  }
}

@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })
export class ProductRepository extends HttpRepository<IProduct> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'products' });
  }
}

// 2. The application: an IoC container that declares what it binds.
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
  }
}

// 3. A resource page. The hooks resolve from the container that ArdorApplication provides.
const ProductList = () => {
  const products = useRepository({ target: ProductRepository });
  const translate = useTranslate();
  const [total, setTotal] = useState<number>();

  useEffect(() => {
    void products.count({ where: {} }).then(({ count }) => setTotal(count));
  }, [products]);

  return (
    <section>
      <h1>products ({total ?? '...'})</h1>
      <button type="button">{translate('ra.action.refresh')}</button>
    </section>
  );
};

// 4. Start the container, then hand it to the root component.
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
- `ProductRepository` extends `HttpRepository` from `@venizia/ardor/repository`. It reads the `products` resource with the IGNIS filter vocabulary, and `count` reads the total from the `Content-Range` header. `ApiDataSource` is the transport; `readAuthTokenFromStorage` gives it the token the auth provider stored.
- `baseUrl` may also be relative, such as `'/api'` behind a dev-server proxy: it resolves against the page when a request is sent.
- `@datasource()` and `@repository(...)` declare the two classes, as IGNIS does. `start()` binds each as a singleton and records the key on the class, so `useRepository({ target })` resolves by class: no key string to type, and nothing a minifier can rename. `RepositoryTypes.REMOTE` says the repository has no model, and `@repository` injects the datasource into its constructor. Registering by hand with `this.dataSource(...)` and `this.repository(...)` works too - see [Binding keys](../../best-practices/binding-keys).
- `Application` extends `BaseArdorApplication`. Two methods are abstract: `getAppInfo()` returns the app's name, version and description; `bindContext()` declares every binding. Three option values feed the three default providers, and `DefaultAuthService` backs `DefaultAuthProvider`.
- `application.start()` runs `preConfigure()`, which binds the application instance, its info and every decorated class, then calls your `bindContext()`. It then runs `postConfigure()`, which is empty by default.
- `ProductList` resolves the repository with `useRepository`, which also checks the class is bound under `repositories.`, and `useTranslate` resolves a message key against the bundles bound to `I18N_PROVIDER_OPTIONS`.
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

- The heading shows the product total. It came from `ProductRepository`, resolved by class from the container, not from props.
- The button label comes from `translate`, which resolves the key through the i18n provider bound in `bindContext()`.

If the count throws "carried no Content-Range", your list route does not send that header; pass `countPath` to the repository if the API has a count route.

## What you built

A running ARDOR admin: one application class that binds REST, auth and i18n options, the three default providers, one datasource and one repository the application discovered, and one resource page that resolves the repository by class - in one file.

## Next steps

- Teach TypeScript your binding and message keys: [Module augmentation](../../best-practices/module-augmentation)
- Every key the framework binds and reads: [Binding keys](../../references/binding-keys)
- The application lifecycle and `ArdorApplication` props: [Application](../../references/application)
- What the REST data provider does with `url`, `noAuthPaths` and `authRecovery`: [Data provider](../../references/data-provider)
- Sign-in paths and redirects: [Auth provider](../../references/auth-provider)
- Message bundles and languages: [i18n](../../references/i18n)
- The full hook list: [Hooks](../../references/hooks)
- Coming from `@minimaltech/ra-core-infra`: [Migration guide](../migration/from-ra-core-infra)
