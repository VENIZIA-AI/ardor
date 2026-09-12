# vert-admin

The family reference: an ARDOR admin console over IGNIS's [`examples/vert`](https://github.com/VENIZIA-AI/ignis/tree/develop/examples/vert)
API. It exercises what a production console needs from the framework: sign-in through the IGNIS
authentication component (`/auth/sign-in`), `checkAuth` against `/auth/who-am-i`, one-shot token
recovery through `/auth/token/refresh`, and a react-admin list over the `configurations` CRUD
controller with totals read from `content-range`.

## Run

`vert` needs PostgreSQL and Redis - follow its README first:

```bash
cd ../../../ignis/examples/vert
cp .env.example .env.development     # database credentials
bun install && bun run migrate:dev && bun run server:dev      # API on :3000
```

Then this console:

```bash
cd examples/vert-admin
bun run dev                          # Vite on :5173, proxying /api to :3000
```

Sign in with a user seeded in `vert` (`bun run seed:authz` there creates test accounts).

| File | What it shows |
| --- | --- |
| `src/application.ts` | `VertPaths` (the IGNIS auth component's routes), `authRecovery` wired to the refresh endpoint through an injected service, `bindingList()` |
| `src/pages/configurations.tsx` | `useListContext` over a CRUD controller, `useInjectable`, `useNotifyError` with an `ApplicationError` |
