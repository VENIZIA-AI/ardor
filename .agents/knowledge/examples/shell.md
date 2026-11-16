---
type: Example
title: shell
description: A thin ARDOR shell over two feature packages, with a role table, a menu filtered by access, a gated route, a public page outside the layout and a lazy locale.
resource: examples/shell
tags: [example, shell, features, permissions, menu, i18n]
---

## What it demonstrates

`examples/shell` is the reference for an application split into a thin shell and feature packages.
The shell owns sign-in, the layout, the role table and the locales; each feature owns its pages,
classes and messages. It shows, end to end:

- **Feature packages** - `examples/shell/features/orders` and `examples/shell/features/catalog` are
  workspace packages (`@shell-example/orders`, `@shell-example/catalog`) under their own workspace glob,
  `examples/*/features/*`. Each exports one `Features.define({ name, resources, routes, menu, messages,
  artifacts, permissions })` value, and the shell lists both in `Application.features()`. See
  [Feature modules](/architecture/feature-modules.md).
- **Features that carry their own classes** - the Vite plugin lists only the shell's `src/`, so
  `AutoArtifacts` holds the shell's two configurations and nothing of a feature. Each feature lists its
  datasource, repository and service in `artifacts`; importing the feature imports them, which
  decorates and so discovers them, and `start()` checks each was discovered. The bundle of
  `bun run compile` keeps the names of the feature classes (`Object.defineProperty(this, 'name', ...)`),
  so their derived binding keys hold in production.
- **A role table** - `RolePermissionProvider` bound with one line in `bindContext()`, its grants in
  `PermissionConfiguration` through `@provide({ key: CoreBindings.PERMISSION_PROVIDER_OPTIONS })`:
  `admin` holds `*`, `viewer` holds `orders.list` and `products.list`. The grant strings are the
  constants the features export. See [Feature modules: permissions](/architecture/feature-modules.md#permissions).
- **A menu filtered by access** - `ShellLayout` renders `Ardor.useMenuEntries()` and the role badge
  from `Ardor.useRoles()`. A viewer sees two entries, an admin three.
- **A gated route** - `/orders/summary` declares `access: { resource: 'orders', action: 'summary' }`
  and loads its page with `React.lazy`. A denied user is sent to the default access-denied page at
  `/access-denied`, the redirect a custom route with `access` makes when denied.
- **The default access-denied page** - `orders` also has a `show` page. A viewer, who holds no
  `orders.show`, lands on `AccessDeniedPage` at `/access-denied`, the redirect react-admin makes for a
  resource page. react-admin can start the `getOne` before the check answers; the stub API refuses
  it then (403), because the backend checks every request.
- **A public page outside the layout** - `/catalog/share` declares `layout: { use: false }` and
  `auth: { use: false }`, and renders for a visitor who never signed in.
- **A lazy locale** - `orders` gives `en` as an object and `vi` as `() => import('./messages/vi')`.
  The shell offers both locales; the language button loads the bundle the first time.

## How to run

```bash
bun install && make build   # from the repository root
cd examples/shell
bun run server:dev          # the stub API on :3100 and Vite on :5173, proxying /api
bun run test                # the boot, grants, menu and route tests (happy-dom)
```

Sign in with `admin` / `admin` or `viewer` / `viewer`. react-admin's router is a hash router: the
summary page is `http://localhost:5173/#/orders/summary`.

## What the stub API returns

`api/server.ts` answers `POST /api/auth/sign-in` with `{ userId, roles, token: { value, type } }` for
the two users, and `GET /api/orders` and `GET /api/products` with the list contract (`content-range`).
It reads `skip`, `limit` and equality in `where`, which `OrderRepository.countByStatus` uses. A token
names its user, and a viewer gets 403 on a single row.

## Tests

The tests run with `bun run test` in the example, under happy-dom: no gate and no CI job runs them
(CI runs `make typecheck-examples` only). They start the real `Application`, save a session with
`DefaultAuthService.saveAuth`, and render `ArdorApplication` under a `MemoryRouter`, because
react-admin's own router fails in happy-dom.

- `boot.test.ts` - `assertArdorApplicationBoots`, which also loads both locales of both features.
- `permission.test.ts` - the answers of the bound provider for `viewer`, `admin` and a user with no role.
- `menu.test.tsx` - the menu per role, and the Vietnamese menu after the lazy bundle loads.
- `routes.test.tsx` - the public page signed out, the gated route for each role, and the access-denied page.

## What to read first

`src/application.ts` (the features, the one binding), `src/configurations/permission.configuration.ts`
(the grants), `features/orders/src/index.ts` (one feature in one value), `src/components/shell-layout.tsx`
(the menu and the role badge), then `src/__tests__/shell.tsx` for how a test starts the shell.
