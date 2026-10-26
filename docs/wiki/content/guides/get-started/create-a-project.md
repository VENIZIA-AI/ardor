---
title: Create a Project
description: Scaffold a new ARDOR monorepo or add an admin application to an existing monorepo with VULCAN.
---

# Create a Project

`bun x @venizia/vulcan init --preset ardor` creates a monorepo with one ARDOR admin inside it. To add an admin to a monorepo that already exists, run `bun x @venizia/vulcan add --preset ardor` at its root.

Both commands need VULCAN 0.4.0 or newer: it writes the `bunfig.toml` that sets the format and sorts the `package.json` it generates (`--scope` for an app arrived in 0.3.11). `bun x` fetches the latest release, so you have it unless you pinned an older one.

## Initialize a New Monorepo

Pass each answer as a flag, and `init` asks nothing: `--project` (the monorepo folder), `--frontend-dir` (holds every frontend app), `--app` (the app name) and `--shared-dir` (shared code; leave it out to skip). A name is lowercase letters, digits and `-`:

```bash
bun x @venizia/vulcan init --preset ardor --project demo --frontend-dir apps --app admin
```

To name the app's package with a scope, add `--scope @acme`: the package is `@acme/admin` and the folder stays `apps/admin`. Without the flag the package is named `admin`.

In a terminal, leave a flag out and `init` asks for it, with nothing pre-filled (the scope is an optional question, empty for none). Then `vulcan sync` asks which coding agents you use (Enter accepts). Without a terminal it writes the Claude files and prints `vulcan sync --agents claude,omp (or none)` for choosing later.

The command prints `created <path>` for each file, runs `bun install`, `vulcan sync`, the app's four checks (`bun run typecheck`, `bun run lint`, `bun run test`, `bun run compile`), `vulcan doctor` and `vulcan x okf check --strict`, and ends with:

```text
Done. Next:
  cd demo && make dev
  open http://localhost:5173/
```

### What it Created

The command generates the project folder `demo/`:

```text
demo/
  package.json            workspaces, one catalog with every version
  Makefile  README.md  AGENTS.md  .mcp.json  .gitignore  .dockerignore  bunfig.toml
  .configs/vulcan.config.mts
  .agents/rules.md  .agents/vulcan.manifest.json  .agents/knowledge/{index.md,packages/admin.md}
  apps/admin/
    package.json  tsconfig.json  .env.example
    .configs/lints/{oxlint.config.mts,eslint.config.mjs,.ignore}  .configs/formatters/.ignore
    .configs/builders/{vite.config.mts,Dockerfile,nginx.conf.template}
    .configs/builders/nginx-snippets/{security-headers.conf,api-proxy.conf}
    .configs/builders/docker-entrypoint.d/{40-runtime-config.sh,45-api-proxy.sh}
    src/index.html  src/public/config.js  src/main.tsx  src/application.ts  src/application.test.ts
    src/configurations/admin.configuration.ts
    src/pages/home.tsx
    src/components/shadcn/{button,card}.tsx
    src/themes/index.css  src/utilities/tw.utility.ts
```

`vulcan sync` also writes your agent files (`CLAUDE.md`, `.claude/`), which `.gitignore` keeps out of git. The compile check leaves `apps/admin/dist/`. The application is small:

- `src/main.tsx` renders `ArdorApplication` with the home page as its `dashboard`.
- `src/application.ts` is the application, which lists the decorated classes the Vite plugin found (`AutoArtifacts`).
- `src/configurations/admin.configuration.ts` binds the REST data provider and the i18n provider (the auth provider stays unbound, so every page is public).
- `src/pages/home.tsx` is the one page: the ARDOR logo, the app name and the message the backend answers to `GET /api/hello`, in a card on a soft wash of the brand gradient. It shows a placeholder while it loads, and when the backend is down it says so and shows `bun run server:dev`, the command that starts it, with a button to try again. The call goes through the data provider's `send`, not a raw `fetch`. Replace the page with your own.
- `src/components/shadcn/*` are shadcn-style components, copied into the app as shadcn does, so you own them. There is no `components.json` (the app root holds nothing else): to add more with the shadcn CLI, run `bunx shadcn init` first, which writes its own.
- `src/themes/index.css` is the whole Tailwind CSS v4 setup: `@import 'tailwindcss'`, the colour tokens of ARDOR's palette in a light and a dark set, and `@theme`. The theme follows the system's light or dark preference; there is no `tailwind.config` file.
- `src/application.test.ts` is the one test: it starts the container and checks that the configuration binds the REST data provider options.
- `package.json` has the script names every ARDOR and IGNIS app has: `server:dev` and `compile` (`vite` and `vite build`, with `--config .configs/builders/vite.config.mts`; `compile` writes `dist/`), `typecheck` (`bun check`), `lint` and `lint:fix` (`devz lint`, the `devz` bin of `@venizia/dev-configs`), `test` (`bun test`) and `clean` (`devz clean`, which removes `dist/` and the tool caches). There is no `dev` and no `build`.
- `.env.example` lists the variables the app reads: `PORT` (default 5173) and `API_URL`, the backend that the dev server forwards `/api` to, and `VITE_API_URL`, the API the app calls (see [One image for every environment](#one-image-for-every-environment)). An empty value keeps the default, which for `API_URL` is the backend chosen when the app was added and for `VITE_API_URL` is `/api`. Copy the file to `.env` to change them on your machine; `.env` stays out of git and out of the image.
- `bunfig.toml` at the root of the monorepo holds the format of every file: its `[fmt]` section sets the print width, single quotes and arrow parentheses, and `devz lint` formats with `bun fmt`, which reads it from the app's folder up. There is no formatter config in the app.
- `.configs/lints/.ignore` and `.configs/formatters/.ignore` hold only comments. `devz lint` skips the files whose patterns you add (one gitignore-style pattern per line, relative to the app): `lints/.ignore` for oxlint and ESLint, `formatters/.ignore` for `bun fmt`, which is where shadcn's `src/components/shadcn/**` goes if it must keep its own format.
- `.configs/builders/vite.config.mts` has the dev port and the `/api` proxy, from those variables. Vite's root is `src/` (that is where `index.html` is), so the app root holds nothing but `.configs/`, `src/`, `package.json`, `tsconfig.json` and `.env.example`.
- `.configs/builders/Dockerfile` and `nginx.conf.template` build and serve the app: see [An image of the app](#an-image-of-the-app).

### An image of the app

The Dockerfile builds the app and serves it with nginx. Build it from the monorepo root, so the workspace packages and the lockfile are in the context. `init` leaves the repository without a commit, and until you make one `git rev-parse HEAD` prints the word `HEAD`, which the build refuses, so commit first:

```bash
git add . && git commit -m "First commit"
docker build -f apps/admin/.configs/builders/Dockerfile -t admin \
  --build-arg APP_BUILD_COMMIT="$(git rev-parse HEAD)" \
  --build-arg APP_BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)" .
docker run --rm --network host -e API_UPSTREAM=http://127.0.0.1:3000 admin
```

Open `http://localhost:8080`. On Linux, `--network host` lets the container reach the backend that `make dev` serves on port 3000 of your machine, so there is no `-p`. In compose or a cluster, `API_UPSTREAM` is the service name (`http://api:3000`) and the container needs no special flag. nginx resolves the name with DNS, not with `/etc/hosts`, so a name added with `--add-host` does not work; an IP address does. A host that does not resolve does not stop the container: the page answers, and `/api` answers 502 until the name resolves.

What the image does:

- **Three stages.** `deps` installs with `bun install --frozen-lockfile --ignore-scripts`, `builder` runs `bun run compile`, and `production` is nginx (unprivileged, port 8080) serving `dist/`. Every route that is not a file answers with `index.html`.
- **`/api` proxy.** `/api` goes to `API_UPSTREAM` (default `http://api:3000`): a compose service name, a cluster service or an address. The script `45-api-proxy.sh` writes the proxy from `nginx-snippets/api-proxy.conf` only when `API_UPSTREAM` is set and not empty, so an app served behind a gateway runs with `-e API_UPSTREAM=` (or `ENV API_UPSTREAM=` in its Dockerfile) and has no `/api` at all. A value that is not an address (a space, a `;`, a quote) stops the container.
- **`/health`.** Answers `200 ok` from nginx alone, never cached, for a load balancer or an orchestrator. It does not call the backend.
- **Compression.** nginx gzips text, JavaScript, CSS, JSON and SVG.
- **Security headers.** Every response carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: SAMEORIGIN`. They are in `nginx-snippets/security-headers.conf`, which every location includes; a `Content-Security-Policy` is left there as a commented example, because the right one depends on what your app loads.
- **No secrets.** An environment file in the build context would stay in the image's layers, so the `deps` stage stops when the context holds one. The root `.dockerignore` keeps `.env` and `.env.*` out and `.env.example` in.
- **The commit.** The image has no `.git`, so a build without `APP_BUILD_COMMIT` stops, and so does a value that is not a sha of at least seven lowercase hex digits (`Pass --build-arg APP_BUILD_COMMIT=$(git rev-parse HEAD) after a first commit; got: HEAD`). The commit becomes the `org.opencontainers.image.revision` label of the image.
- **A private registry.** `BUN_CONFIG_REGISTRY` is empty; pass it as a build argument to install from one.

The preset cannot know which workspace packages the app needs, so the build copies the whole context (the root `.dockerignore` filters it). To keep a change in a source file from redoing the install, list the packages by hand and copy each `package.json` first.

### One image for every environment

A value like the API address is usually fixed when you run `vite build`, so each environment needs its own image. The image of the preset reads it when the container starts instead:

```bash
docker run --rm -p 8080:8080 \
  -e API_UPSTREAM=http://api:3000 \
  -e VITE_API_URL=https://api.example.com \
  admin
```

At start the image writes `/config.js` from the container's `VITE_` variables, and `index.html` loads it before the app. The app reads a value with `getRuntimeConfig`: the value in `config.js`, else the build-time `import.meta.env` (this is what dev uses, from `.env`), else the default you give. Pass `required: true` for a value the app cannot run without: the result is then a `string`, and a missing value throws an error that names the key (never a value) and whose `normalized.code` is `RUNTIME_CONFIG_REQUIRED_CODE`, so code can tell it without reading the message. The preset uses it once, for `VITE_API_URL`, in `src/configurations/admin.configuration.ts`.

| Rule | What it means |
|---|---|
| Only `VITE_` variables are published | The name must be `VITE_` followed by capitals, digits and underscores. `DATABASE_URL`, `API_UPSTREAM` and every other variable stay in the container. |
| A published value is public | Every visitor can read `/config.js`. Never put a secret in a `VITE_` variable. |
| Secret-looking names stop the container | A `VITE_` name with `SECRET`, `PASSWORD` or `TOKEN` in it makes the container exit and name the variable, so a mistake shows at deploy. A name with `KEY` is fine: public keys are normal. |
| Values are escaped | Quotes, backslashes, newlines and `<` cannot end the string or the file. |
| `config.js` is never cached | nginx answers it with `Cache-Control: no-store`. |
| A mounted `config.js` wins | If you mount a read-only file over it, the container keeps your file. |

In dev and in `vite build`, `config.js` is the empty `src/public/config.js`, so the app falls back to `.env`.

#### Require variables

By default a container starts whatever its environment holds, and an app with a missing value falls back to its build-time one. To refuse to start instead, list the variables the app cannot run without in `APP_REQUIRED_ENV`, in the app's Dockerfile:

```dockerfile
ENV APP_REQUIRED_ENV="VITE_API_URL,API_UPSTREAM"
```

```bash
docker run --rm -e API_UPSTREAM=http://api:3000 admin
# [runtime-config] FATAL: required variable(s) missing or empty: VITE_API_URL
```

| Rule | What it means |
|---|---|
| A comma-separated list | `VITE_API_URL,API_UPSTREAM`. Spaces around a name and empty entries are ignored. |
| Unset or empty is missing | The container exits with code 1 and names every missing variable, in the order listed, once each. No `config.js` is written. |
| Any variable name | The list is not limited to `VITE_` names, so `API_UPSTREAM` can be required. A name outside `VITE_` is still not published. |
| No value is printed | Only names reach the message, so a secret cannot leak through a failed start. |
| A bad entry stops the container | An entry that is not a variable name (letters, digits and `_`, not starting with a digit) exits with code 1 and gives its position in the list. |
| Nothing listed, nothing checked | An unset or empty `APP_REQUIRED_ENV` keeps the start as it was. `-e APP_REQUIRED_ENV=...` overrides the list for one environment. |
| A mounted `config.js` is not checked | A read-only file mounted over `config.js` is kept as supplied, and the variables are not checked. |

### Expected API

The app has no sign-in and expects one route of the backend: `GET /api/hello` answering `{ "message": "..." }`, which an IGNIS app made from its preset has. To use your own resources, add them in `src/main.tsx` (`resources`). For sign-in, see [Add sign-in](../tutorials/add-sign-in).

## Add an Admin to an Existing Monorepo

To add an admin to a monorepo that already exists (for example one created with `bun x @venizia/vulcan init --preset ignis`), run this at its root:

```bash
bun x @venizia/vulcan add --preset ardor --app web --frontend-dir apps --api api
```

`--api` names the backend app to proxy `/api` to (here `api`, one of the monorepo's backend apps). For an admin that talks to some other backend, pass `--no-api` instead. Without `--api <app>` or `--no-api`, and without a terminal, the command stops with `vulcan add: missing --api <app> or --no-api`. In a terminal, `add` asks for what you leave out: the frontend folder (once chosen it is offered as the answer next time), the app name and the backend app. `--scope @acme` names the package `@acme/web` and leaves the folder `apps/web`. The dev server port is 5173, or the next free one when another app already uses it. The proxy target is `http://localhost:<port of that backend app>`, read from the backend's `.env.example`.

The monorepo's catalog keeps its versions of the IGNIS packages and of `@venizia/dev-configs` (the admin's lint config needs 0.4.0 or newer, the release whose `devz` formats with `bun fmt`): a version already in the catalog wins, so every app shares one copy. If the catalog pins an IGNIS version outside the range ARDOR supports, `add` stops before writing anything and names both versions, for example `the monorepo pins @venizia/ignis-kernel 0.1.0, but the preset needs ^0.2.2 - move the catalog first`.

## Add a Feature Library

A feature is a package of routes, resources and messages that more than one app mounts. To add one to the monorepo, run this at its root:

```bash
bun x @venizia/vulcan add --preset ardor --lib merchant --dir libs --scope @acme
```

`--dir` is the folder of the libraries (without it, VULCAN uses the folder of the libraries the monorepo already has), and `--scope` sets the package scope (without it the package is named `merchant`). Without `--lib` or `--app`, the command asks in a terminal and stops without one.

It creates `libs/merchant` as the package `@acme/merchant`:

```text
libs/merchant/
  package.json     name, exports ".", imports #src/*, the scripts, catalog: versions
  tsconfig.json
  .configs/lints/{oxlint.config.mts,eslint.config.mjs}  .configs/formatters/.ignore
  src/index.ts  src/feature.ts  src/feature.test.ts
```

- `src/feature.ts` is `Features.define({ name: 'merchant' })`, empty until you add routes, resources and messages to it.
- `src/feature.test.ts` mounts it in a small application and reads it back, so the test runs from the first day.
- The scripts are `typecheck`, `lint`, `lint:fix`, `test` and `clean`. There is no bundler and no dev server: an app that imports the package compiles its source.
- `@venizia/ardor`, `react`, `react-dom`, `react-router-dom` and `reflect-metadata` are peer dependencies, so the app decides the versions.

An app mounts the feature by listing it in `features()`: `import { feature } from '@acme/merchant'`.

## Next Steps

After `init` or `add`: `cd <project>`, then `make dev` at the root (or `bun run server:dev` in `apps/admin`) serves the admin on `http://localhost:5173/`. In a library, `bun run test` runs the feature's test.

- Already have a Vite project? See [Set up your environment](./setup) for the manual way.
- For a guided walk through the code, see [5-minute quickstart](./5-minute-quickstart).
