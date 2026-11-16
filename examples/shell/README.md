# Shell with feature packages

A thin ARDOR shell and two feature packages. The shell owns sign-in, the layout, the role table and
the locales. Each feature owns its pages, its classes and its messages, and the shell mounts it with
one line in `features()`.

```bash
bun install && make build  # from the repository root: the example runs on the built packages
cd examples/shell
bun run server:dev          # the stub API on :3100 and Vite on :5173, proxying /api
bun run test                # the boot, grants, menu and route tests
```

Open <http://localhost:5173> and sign in as one of the two users:

| User | Password | Roles | What the menu lists |
| --- | --- | --- | --- |
| `admin` | `admin` | `admin` | Orders, Order summary, Products |
| `viewer` | `viewer` | `viewer` | Orders, Products |

The viewer may list orders and products, and nothing else. Opening an order sends the viewer to the
access-denied page; opening `#/orders/summary` shows the layout and no page. Anyone, signed in or not,
can open `#/catalog/share`. The language button switches to Vietnamese, and the orders feature loads its
Vietnamese messages the first time.

The permission names a feature lists in `permissions` describe what its pages check, for a role
editor to list. They enforce nothing: `access` on a route or a menu entry is what asks the provider.

| File | What it shows |
| --- | --- |
| `src/application.ts` | `AutoArtifacts`, the two features in `features()`, `RolePermissionProvider` bound in `bindContext()` |
| `src/configurations/permission.configuration.ts` | The role table, as `@provideOption` options: `admin` holds `*`, `viewer` two list grants |
| `src/configurations/shell.configuration.ts` | The REST data, auth (`{ use: true, paths }`) and i18n options, with English and Vietnamese offered |
| `src/components/shell-layout.tsx` | The menu from `Ardor.useMenuEntries()`, the role badge from `Ardor.useRoles()`, the language button |
| `features/orders/src/index.ts` | One feature in one `Features.define` value: resource, gated route, menu, messages, artifacts, permissions |
| `features/orders/src/services/order.service.ts` | A feature service that uses the feature's repository |
| `features/orders/src/messages/vi.ts` | The Vietnamese bundle, loaded lazily through `() => import('./messages/vi')` |
| `features/orders/src/pages/order-summary.tsx` | The page of the route that needs `orders.summary`, loaded with `React.lazy` |
| `features/catalog/src/index.ts` | A public route outside the layout: `layout: { use: false }`, `auth: { use: false }` |
| `src/__tests__/boot.test.ts` | `assertArdorApplicationBoots`: every binding of shell and features, and both locales |
| `src/__tests__/permission.test.ts`, `menu.test.tsx`, `routes.test.tsx` | The grants, the menu per role, and the routes for each role |
| `api/server.ts` | Sign-in for the two users and the list contract of both resources; a viewer gets 403 on one row |

The feature packages are workspace packages under `features/*`. The shell's Vite plugin lists only
its own `src/`, so a feature's datasource, repository and service are bound because the feature lists
them in `artifacts`: importing the feature imports them.

---

<p align="center">
  <a href="https://venizia.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://venizia.ai/assets/logo-white.svg">
      <img src="https://venizia.ai/assets/logo.svg" alt="VENIZIA" height="28">
    </picture>
  </a>
  <br>
  <sub>ARDOR is built and maintained by <a href="https://venizia.ai">VENIZIA</a>.</sub>
</p>
