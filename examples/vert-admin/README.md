# vert-admin

The family reference: an ARDOR admin console over IGNIS's [`examples/vert`](https://github.com/VENIZIA-AI/ignis/tree/develop/examples/vert)
API. It exercises what a production console needs from the framework: sign-in through the IGNIS
authentication component (`/auth/sign-in`), `checkAuth` against `/auth/who-am-i`, one-shot token
recovery through `/auth/token/refresh`, and a react-admin list over the `configurations` CRUD
controller with totals read from `content-range`.

## Run

`vert` needs PostgreSQL, Redis and its ES256 keys - follow its README first (`docker compose up -d`, `cp .env.example .env`, the keys, then):

```bash
cd ../../../ignis/examples/vert
bun install && bun run migrate:dev && bun run server:dev      # API on :1190, under /v1/api
```

Then this console:

```bash
cd examples/vert-admin
bun run server:dev                    # Vite on :5173, proxying /v1/api to :1190
```

Create a user with `POST /v1/api/auth/sign-up`, as the README of `vert` shows, and sign in with it. `bun run seed:authz` there makes organizations, roles and permissions, no user, and it deletes the rows of those tables first.

| File | What it shows |
| --- | --- |
| `src/application.ts` | The application alone, with `AutoArtifacts` from the Vite plugin |
| `src/constants/vert-paths.ts`, `src/services/`, `src/providers/`, `src/configurations/` | `VertPaths` (the IGNIS auth component's routes), `IdentityService`, the 401 refresh as a `refreshToken` hook of a network service subclass returned by `createNetworkService`, and the bindings - one decorated class per file |
| `src/pages/configurations.tsx` | `useListContext` over a CRUD controller, `useService`, `useNotifyError` with an `ApplicationError` |

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
