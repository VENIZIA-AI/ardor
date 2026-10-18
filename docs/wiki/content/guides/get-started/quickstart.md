---
title: 5-minute quickstart
description: From a new Vite + React project to a running ARDOR admin - install, decorator flags, an application class that declares its providers and one repository, a resource page and a login page, and the bundle it builds. The code is the examples/5-mins-qs example, included from its files.
---

# 5-Minute Quickstart

Build a working ARDOR admin: one application file that declares the three default providers and a repository, a resource page that resolves the repository through a hook, a login page, and the bootstrap that mounts the root component.

**Time to complete:** ~5 minutes

> **Prerequisite:** Bun 1.4 or later, and a REST API to point the data provider at. The code below signs in at `POST /auth/sign-in`, IGNIS's route, which answers `{ token: '<jwt>' }`, and lists `products`. A runnable stub of that API is [`examples/5-mins-qs/api/server.ts`](https://github.com/VENIZIA-AI/ardor/blob/main/examples/5-mins-qs/api/server.ts). An API with no sign-in, or one that signs in elsewhere, needs a different auth setup - see [Your API is not this one](#your-api-is-not-this-one).

Every code block on this page is a file of [`examples/5-mins-qs`](https://github.com/VENIZIA-AI/ardor/tree/main/examples/5-mins-qs), included as it is. `bun scripts/examples.ts build` builds that example against the packages, so the page cannot drift from code that compiles.

## 1. Create the project

Scaffold a Vite + React + TypeScript project and install ARDOR with its peers:

```bash
bun create vite my-admin --template react-ts
cd my-admin
bun install
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-kernel @venizia/ignis-helpers @venizia/ignis-connectors ra-core react react-dom react-redux @reduxjs/toolkit react-router-dom @tanstack/react-query reflect-metadata
```

`@venizia/ardor` is the umbrella package. It re-exports `@venizia/ardor-kernel`, `@venizia/ardor-react`, and `@venizia/ardor-admin`, so the application needs one import path. `@venizia/ignis-connectors` is only for `@venizia/ardor/repository`, which this guide uses.

> [!IMPORTANT]
> Keep every `@venizia/ignis-*` package on the same version, and move them together (`bun update @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-kernel @venizia/ignis-helpers @venizia/ignis-connectors`). ARDOR's peer ranges are floors per package, so a project with one package a release behind another still installs without a warning.

## 2. Configure TypeScript for decorators

ARDOR's container is `@venizia/ignis-inversion`, which relies on TypeScript's legacy decorators and their metadata. Set the two flags directly in the `tsconfig` that includes `src` (`tsconfig.app.json` in a Vite scaffold). Put them inline, not behind an `extends` chain, as IGNIS requires. The `@/*` path is the alias the files below import through.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

## 3. Write the application

`src/application.ts` is the container side: the datasource, the repository, the framework bindings and the application class.

<<< @/../../../examples/5-mins-qs/src/application.ts{ts}

What each part does:

- `@datasource()` and `@repository(...)` declare the two classes, as IGNIS does. `start()` binds each as a singleton and records the key on the class, so `useRepository({ target })` resolves by class: no key string to type, and nothing a minifier can rename. `RepositoryTypes.REMOTE` says the repository has no model, and `@repository` injects the datasource into its constructor. Registering by hand with `this.dataSource(...)` and `this.repository(...)` works too - see [Binding keys](../../best-practices/binding-keys).
- `ProductRepository` extends `HttpRepository` from `@venizia/ardor/repository`. It reads the `products` resource with the IGNIS filter vocabulary, and `count` reads the total from the `Content-Range` header. `ApiDataSource` is the transport; `readAuthTokenFromStorage` gives it the token the auth provider stored. `baseUrl` is relative here, so it resolves against the page and the dev server proxies it.
- `AdminConfiguration` binds the framework. `start()` binds each `@provide` method under its key, SINGLETON, built on first use, so react-admin, the auth provider and every hook share one data provider with its token, headers and single 401 refresh. `noAuthPaths` lists the paths reached before a token exists; any other path is sent with an `Authorization` header.
- `Application` extends `BaseArdorApplication`. Two methods are abstract: `getAppInfo()` returns the app's name, version and description; `bindContext()` is empty here, because the bindings live in `AdminConfiguration`.
- `declare module '@venizia/ardor-admin'` teaches `useTranslate` the two message keys this application adds - see [Module augmentation](../../best-practices/module-augmentation).

## 4. Write the pages

`src/pages/product-list.tsx` reads the page react-admin fetched from the list context, and asks the repository a question the page cannot answer alone.

<<< @/../../../examples/5-mins-qs/src/pages/product-list.tsx{tsx}

`useRepository` resolves the repository by class and checks it is bound under `repositories.`; `useTranslate` resolves a message key against the bundles bound to `I18N_PROVIDER_OPTIONS`.

`src/pages/login.tsx` is the form react-admin shows when `checkAuth` rejects. `useLogin` calls the auth provider's `login` with whatever object you pass, here `{ username, password }`, which the provider turns into IGNIS's sign-in body.

<<< @/../../../examples/5-mins-qs/src/pages/login.tsx{tsx}

## 5. Mount it

`src/main.tsx` starts the application, then hands the container to the root component.

<<< @/../../../examples/5-mins-qs/src/main.tsx{tsx}

- `import 'reflect-metadata'` must be the first import: it has to run once, before the application class is defined.
- `application.start()` runs `preConfigure()`, which binds the application instance, its info, every decorated class and every `@provide` method of `AdminConfiguration`, then calls your `bindContext()`. It then runs `postConfigure()`, which is empty by default.
- `ArdorApplication` reads the data provider, auth provider and i18n provider from the container by their `CoreBindings` keys, wraps the tree in the application context, the Redux provider and `React.Suspense`, and renders one react-admin `Resource` per entry in `resources`. Any other prop, such as `loginPage`, is passed to `CoreAdmin` as-is.

## 6. Configure Vite

`vite.config.ts` aliases `@` to `src`, forwards `/api` to the API, and splits the vendor code (see [The bundle](#the-bundle)). Point the proxy target at your API; in a real project read it from an environment variable.

<<< @/../../../examples/5-mins-qs/vite.config.ts{ts}

## 7. Run it

Start the dev server:

```bash
bun run dev
```

Open the URL Vite prints (`http://localhost:5173` by default), sign in, and the admin routes the `products` resource to `ProductList`.

Two things confirm the container is doing the work:

- The heading shows the product total and the list shows the page. They came from `DefaultRestDataProvider`, resolved from the container by `ArdorApplication`, with the total read from `Content-Range`.
- The "expensive products" count came from `ProductRepository`, resolved by class from the container, and its heading from `translate`, which resolves the key through the i18n provider provided in `AdminConfiguration`.

If the count throws "carried no Content-Range", your list route does not send that header; pass `countPath` to the repository if the API has a count route.

## The bundle

A production build of this application is about 590 KB (186 KB gzipped), and Vite's default warns above 500 KB for one chunk. Nothing heavy comes in by default. Measured per package on this example, React DOM is about 200 KB, the router 95 KB, `ra-core` 35 KB, `lodash` 34 KB and TanStack Query 31 KB, which is what any react-admin application starts from. ARDOR and the IGNIS packages it needs in the browser (`ardor-admin`, `ardor-kernel`, `ignis-kernel`, `ignis-inversion`, `ignis-helpers`, `ignis-connectors`, `reflect-metadata`) come to about 110 KB, a fifth of it.

The `build.rolldownOptions.output.codeSplitting` groups in `vite.config.ts` split the bundle into three chunks - the application (49 KB), React (219 KB) and the other vendor code (321 KB) - without shrinking the total. The warning goes away because no chunk is over the limit, and a deploy that changes only application code leaves the two vendor chunks cached. For a bigger application, load each resource page with a dynamic `import()` so the browser fetches a page when its route opens; that is what shrinks the first load.

## Your API is not this one

- **No sign-in.** Leave the auth provider (and its options and service) unbound, drop `loginPage`, and set `useAuth: false` on `REST_DATA_PROVIDER_OPTIONS`: the admin runs with every page public. See [An application with no sign-in](../../references/auth-provider#an-application-with-no-sign-in).
- **An API that signs in elsewhere, or takes the form as it is.** Set `paths.signIn` and `signInBody` in the auth options, and the same path in `noAuthPaths`. The defaults are the IGNIS auth controller's route, body and response - see [The sign-in contract](../../references/auth-provider#the-sign-in-contract).

## What you built

A running ARDOR admin: one application file that binds REST, auth and i18n options, the three default providers, one datasource and one repository the application discovered, a resource page that resolves the repository by class, and a login page.

## Next steps

- Teach TypeScript your binding and message keys: [Module augmentation](../../best-practices/module-augmentation)
- Every key the framework binds and reads: [Binding keys](../../references/binding-keys)
- The application lifecycle and `ArdorApplication` props: [Application](../../references/application)
- What the REST data provider does with `url`, `noAuthPaths` and `authRecovery`: [Data provider](../../references/data-provider)
- Sign-in paths, redirects and the IGNIS contract: [Auth provider](../../references/auth-provider)
- Message bundles and languages: [i18n](../../references/i18n)
- The full hook list: [Hooks](../../references/hooks)
- Coming from `@minimaltech/ra-core-infra`: [Migration guide](../migration/from-ra-core-infra)
