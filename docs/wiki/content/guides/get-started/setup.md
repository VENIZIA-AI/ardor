---
title: Set Up Your Environment
description: Install Bun, scaffold a Vite and React project, configure TypeScript for ARDOR decorators, and verify the build.
---

# Set Up Your Environment

Install the tools to build an ARDOR admin by hand: Bun, a Vite project with React and TypeScript, ARDOR and its peers, and the TypeScript options for decorators. To skip these steps, [create a project](create-a-project): one VULCAN command generates the project already set up.

## Requirements

| Tool | Version | Required | Why |
|---|---|---|---|
| **Bun** | >= 1.4 | Yes | Installs dependencies and runs builds; ARDOR uses Bun across all packages |
| **REST API** | Any | Yes | Backing API for data and authentication; an IGNIS backend or `examples/5-mins-qs/api/server.ts` |
| **Browser** | Current | Yes | The packages are compiled with `lib: ES2025, DOM, DOM.Iterable` (from `@venizia/dev-configs/tsconfig.browser.json`, which `packages/kernel/tsconfig.json` extends) |

## Step 1: Install Bun

Install Bun on macOS, Linux, or Windows Subsystem for Linux (WSL2):

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify that the installed version meets the minimum requirement of Bun 1.4:

```bash
bun --version
```

## Step 2: Create a Vite and React Project

Scaffold a new application using Vite with React and TypeScript:

```bash
bun create vite my-admin --template react-ts
cd my-admin
```

## Step 3: Install ARDOR and Dependencies

Install the umbrella package `@venizia/ardor` together with its peer dependencies:

```bash
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-kernel @venizia/ignis-helpers @venizia/ignis-connectors ra-core ra-i18n-polyglot react react-dom react-redux @reduxjs/toolkit react-router-dom @tanstack/react-query reflect-metadata
bun add -d @venizia/ignis-boot
```

Everything after `@venizia/ardor` is a peer dependency, except `@venizia/ignis-boot`, which is a dev dependency. Peers let your application control a single instance of React, `ra-core`, TanStack Query, and the IGNIS packages; two copies of the same library break React context and container resolution. `@venizia/ignis-connectors` is an optional peer, needed only for `@venizia/ardor/repository`.

Declare every IGNIS package yourself, in every workspace package that uses ARDOR; do not rely on the peer alone. A peer range such as `^0.4.1` never matches a prerelease (`0.4.5-0`), so a package that lists no IGNIS dependency gets the stable copy from the install, next to the prerelease the rest of the repository uses. Two copies of `@venizia/ignis-inversion` are two sets of types, and the build fails with `Type 'Application' is not assignable to type 'IContainer'`. In a monorepo, put the versions in the root `workspaces.catalog` and write `"catalog:"` in each package.

To check a checkout, run the ARDOR gate against it (it walks the members your root `workspaces` field lists, and prints each package that resolves to two versions and the workspace package that holds the older one; a version your `bun.lock` does not hold is marked `stale install`, and the fix is a clean install, not a declaration):

```bash
bun <ardor-checkout>/scripts/release/release-gates.ts single-copy .
```

## Step 4: Configure TypeScript for Decorators

ARDOR uses `@venizia/ignis-inversion` for dependency injection, which requires legacy decorators and metadata reflection. Merge these options into the `compilerOptions` of your `tsconfig.app.json`. The `react-ts` template sets `erasableSyntaxOnly: true`, which rejects the constructor parameter properties ARDOR classes use (`TS1294`), so the last option turns it off:

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
    "paths": { "@/*": ["./src/*"] },
    "erasableSyntaxOnly": false
  }
}
```

## Step 5: Verify Your Setup

Check that TypeScript compiles without errors and that Vite produces a production build:

```bash
bun check --no-pretty -p tsconfig.app.json
bun run build
```

The `-p tsconfig.app.json` flag targets the file edited in step 4. Both commands must exit with code 0.

Next: [Quickstart](./5-minute-quickstart)
