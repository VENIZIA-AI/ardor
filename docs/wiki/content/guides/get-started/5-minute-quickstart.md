---
title: Quickstart
description: Build a small ARDOR admin by hand in a Vite project, with a datasource, repository, configuration class, resource page, and login page.
---

# Quickstart

Build a small ARDOR admin by hand: one datasource, one repository, an application configuration, a resource page, and a login page. You write eight files and run them against a stub API.

> [!TIP]
> Want a running admin without writing these files? [Create a project](create-a-project) generates one with a single command. This page is the manual route, to show what each piece does.

> [!NOTE]
> Start from the Vite `react-ts` project of [Setup](setup): ARDOR installed, TypeScript set up for decorators, and the `@/*` path alias that the imports below use. Step 7 uses `build.rolldownOptions`, which needs Vite 8 or newer (`bun create vite` installs the latest), and Setup installs `@venizia/ignis-connectors`, which `@venizia/ardor/repository` needs.
>
> Step 7 changes how the project builds, so do it first if you want the files to compile as you add them. You also need a REST API for the data provider: the examples talk to the runnable stub API at `examples/5-mins-qs/api/server.ts`.

## 1. The datasource

Create `src/datasources/api.datasource.ts`:

<<< @/../../../examples/5-mins-qs/src/datasources/api.datasource.ts{ts}

`src/datasources/api.datasource.ts` defines the transport for API requests. `@datasource()` registers the class with the container, and `baseUrl: '/api'` sets a relative path that Vite proxies to the backend. It uses `DefaultNetworkRequestService.readAuthTokenFromStorage` to attach stored authentication tokens to outgoing requests. To send the same headers as the data provider and share its 401 refresh, spread `getDataSourceAuth()` instead: see [Resources and pages](../core-concepts/resources-and-pages).

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

`src/pages/product-list.tsx` renders the product listing from the page of products that `useListContext` holds (`data`, `total`, `isPending`), and logs out with `useLogout`. It resolves `ProductRepository` by class with `useRepository()` to fetch the expensive products count independently. `useTranslate()` localizes labels using keys registered in the configuration.

Create `src/pages/login.tsx`:

<<< @/../../../examples/5-mins-qs/src/pages/login.tsx{tsx}

`src/pages/login.tsx` provides the sign-in form rendered when unauthenticated users access protected routes. It uses `useLogin()` from `ra-core` to submit credentials, which `DefaultAuthProvider` converts into the backend authentication request.

## 6. Mount the application

Create `src/main.tsx`:

<<< @/../../../examples/5-mins-qs/src/main.tsx{tsx}

`src/main.tsx` starts the application container and mounts the React root. `reduxStore` is required by `IApplication` and goes to the Redux provider. `await application.start()` binds the application, its info, the discovered classes and their `@provide` methods, then your `bindContext()` (the full order is in [Application](../core-concepts/application)). `ArdorApplication` receives the started container, wraps the tree in providers, and renders the `products` resource.

## 7. Configure Vite

Replace the template's `vite.config.ts` at the project root with this one. `bun run dev` and `bun run build` read that file, so a config kept anywhere else never runs, and Vite cannot resolve the decorated classes. (The example repository keeps its copy at `.configs/builders/vite.config.ts` and passes it with `--config`.)

<<< @/../../../examples/5-mins-qs/.configs/builders/vite.config.ts{ts}

This file configures Vite with `IgnisArtifactsVitePlugin` to discover decorated classes under `src/` at build time. It establishes the `@` path alias, sets up proxy forwarding for `/api` to the stub API on port 3100, and configures vendor code splitting. Point the proxy at your own backend when you have one.

## 8. Run it

The quickstart talks to a stub API that lives in the ARDOR repository. Download it into your project and start it in one terminal (it listens on port 3100):

```bash
mkdir api
curl -fsSL https://raw.githubusercontent.com/VENIZIA-AI/ardor/main/examples/5-mins-qs/api/server.ts -o api/server.ts
bun run api/server.ts
```

Start the Vite development server in another terminal:

```bash
bun run dev
```

Open `http://localhost:5173` in your browser. Sign in with username `admin` and password `admin` to see the product list with its total and the count of expensive products.

If you have your own IGNIS API, skip the stub and point the proxy in `vite.config.ts` at that API.

## Your API is not this one

- **No sign-in.** If your API requires no authentication, leave `DEFAULT_AUTH_PROVIDER` unbound, omit `loginPage` on `ArdorApplication`, and configure `noAuthPathRegex: /./` on `REST_DATA_PROVIDER_OPTIONS`. The admin runs with all pages public.
- **A different sign-in path.** If your API signs in at a custom path or expects different credentials, set `paths.signIn` in `AUTH_PROVIDER_OPTIONS` and add the route to `noAuthPaths` in `REST_DATA_PROVIDER_OPTIONS`. Subclass `DefaultAuthProvider` and override `buildSignInBody` if you need custom request formatting.

For complete authentication options and contracts, see [Auth provider](../../references/auth-provider).

## What you built

An ARDOR admin with a datasource, a repository, an application configuration that wires data and authentication providers, and a localized resource page. The application discovered its decorated classes through `AutoArtifacts`, and `ArdorApplication` mounted the UI with dependency injection intact. The project that [Create a project](create-a-project) generates is built the same way, plus Tailwind, an nginx image and runtime configuration.

## Next steps

- Learn the container lifecycle and application options: [Application](../core-concepts/application)
- Understand providers and configuration classes: [Configuration](../core-concepts/configuration)
- Build a full admin with create and edit forms: [Build an Admin](../tutorials/build-an-admin)
