---
title: 5-Minute Quickstart
description: Build a running ARDOR admin in five minutes with a datasource, repository, configuration class, resource page, and login page.
---

# 5-Minute Quickstart

Build a running ARDOR admin: one datasource, one repository, an application configuration, a resource page, and a login page.

**Time to complete:** ~5 minutes

> [!NOTE]
> This quickstart assumes you have a Vite + React project with ARDOR installed and TypeScript configured for decorators. If you need to set up a project, follow [Setup](setup) first.
>
> You also need a REST API for the data provider. The examples talk to the runnable stub API at `examples/5-mins-qs/api/server.ts`.

## 1. The datasource

Create `src/datasources/api.datasource.ts`:

<<< @/../../../examples/5-mins-qs/src/datasources/api.datasource.ts{ts}

`src/datasources/api.datasource.ts` defines the transport for API requests. `@datasource()` registers the class with the container, and `baseUrl: '/api'` sets a relative path that Vite proxies to the backend. It uses `DefaultNetworkRequestService.readAuthTokenFromStorage` to attach stored authentication tokens to outgoing requests.

## 2. The repository

Create `src/repositories/product.repository.ts`:

<<< @/../../../examples/5-mins-qs/src/repositories/product.repository.ts{ts}

`src/repositories/product.repository.ts` provides typed data access for the `products` resource. `@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })` injects `ApiDataSource` into the constructor, and `RepositoryTypes.REMOTE` specifies that the repository operates without an in-memory model. `countExpensive` queries the API with a filter and reads the total count from the `Content-Range` response header.

## 3. The configuration

Create `src/configurations/admin.configuration.ts`:

<<< @/../../../examples/5-mins-qs/src/configurations/admin.configuration.ts{ts}

`src/configurations/admin.configuration.ts` declares the framework providers and options. Each `@provide()` method binds a service or provider as a singleton on first access, sharing a single data provider across react-admin, the authentication provider, and hooks. See [Configuration](../core-concepts/configuration) for how configuration classes and `@provide` work.

## 4. The application

Create `src/application.ts`:

<<< @/../../../examples/5-mins-qs/src/application.ts{ts}

`src/application.ts` creates the application container by extending `BaseArdorApplication`. Its `artifacts()` method returns `AutoArtifacts`, which supplies the list of decorated classes discovered at build time.

> [!WARNING]
> The module that imports `AutoArtifacts` must not define decorated classes or be imported by them. Violating this rule creates an import cycle that leads to `[artifacts] '<kind>' lists an entry that is not a class (position N)` during startup. Keep each decorated class in its own file and keep `application.ts` free of decorated classes.

## 5. Pages

Create `src/pages/product-list.tsx`:

<<< @/../../../examples/5-mins-qs/src/pages/product-list.tsx{tsx}

`src/pages/product-list.tsx` renders the product listing using react-admin's `useListContext` for data and pagination. It resolves `ProductRepository` by class with `useRepository()` to fetch the expensive products count independently. `useTranslate()` localizes labels using keys registered in the configuration.

Create `src/pages/login.tsx`:

<<< @/../../../examples/5-mins-qs/src/pages/login.tsx{tsx}

`src/pages/login.tsx` provides the sign-in form rendered when unauthenticated users access protected routes. It uses `useLogin()` from `ra-core` to submit credentials, which `DefaultAuthProvider` converts into the backend authentication request.

## 6. Mount the application

Create `src/main.tsx`:

<<< @/../../../examples/5-mins-qs/src/main.tsx{tsx}

`src/main.tsx` starts the application container and mounts the React root. `reduxStore` is required by `IApplication` and goes to the Redux provider. `await application.start()` executes `preConfigure()`, which binds `CoreBindings.APPLICATION_INSTANCE`, `CoreBindings.APPLICATION_INFO`, discovered artifacts and their `@provide` methods via `registerArtifacts()`, `CoreBindings.FEATURES` via `registerFeatures()`, `bindingList()`, and then `bindContext()`. `ArdorApplication` receives the started container, wraps the tree in providers, and renders the `products` resource.

## 7. Configure Vite

Create `.configs/builders/vite.config.ts` (the examples keep their Vite config there and start Vite with `vite --config .configs/builders/vite.config.ts`):

<<< @/../../../examples/5-mins-qs/.configs/builders/vite.config.ts{ts}

This file configures Vite with `IgnisArtifactsVitePlugin` to discover decorated classes under `src/` at build time. It establishes the `@` path alias, sets up proxy forwarding for `/api` to the backend server, and configures vendor code splitting.

## 8. Run it

The stub API is part of the ARDOR repository: from a clone, `cd examples/5-mins-qs && bun run api/server.ts` (listens on :3100, sign in with admin / admin - see `api/server.ts`; in the example itself `bun run server:dev` starts it together with Vite), and a reader with their own IGNIS API skips it and points the Vite proxy (see `vite.config.ts`) at that API.

Start the backend stub API in one terminal:

```bash
cd examples/5-mins-qs && bun run api/server.ts
```

Start the Vite development server in another terminal:

```bash
bun run dev
```

Open `http://localhost:5173` in your browser. Sign in with username `admin` and password `admin` to view the product list.

## Your API is not this one

- **No sign-in.** If your API requires no authentication, leave `DEFAULT_AUTH_PROVIDER` unbound, omit `loginPage` on `ArdorApplication`, and configure `noAuthPathRegex: /./` on `REST_DATA_PROVIDER_OPTIONS`. The admin runs with all pages public.
- **A different sign-in path.** If your API signs in at a custom path or expects different credentials, set `paths.signIn` in `AUTH_PROVIDER_OPTIONS` and add the route to `noAuthPaths` in `REST_DATA_PROVIDER_OPTIONS`. Subclass `DefaultAuthProvider` and override `buildSignInBody` if you need custom request formatting.

For complete authentication options and contracts, see [Auth provider](../../references/auth-provider).

## What you built

A running ARDOR admin with a datasource, a repository, an application configuration that wires data and authentication providers, and a localized resource page. The application discovered its decorated classes automatically through `AutoArtifacts`, and `ArdorApplication` mounted the UI with dependency injection intact.

## Next steps

- Learn the container lifecycle and application options: [Application](../core-concepts/application)
- Understand providers and configuration classes: [Configuration](../core-concepts/configuration)
- Build a full admin with create and edit forms: [Build an Admin](../tutorials/build-an-admin)
