---
title: Set Up Your Environment
description: Install Bun, scaffold a Vite and React project, configure TypeScript for ARDOR decorators, and verify the build.
---

# Set Up Your Environment

Install the tools required to build an ARDOR administrative interface, scaffold a Vite project with React and TypeScript, and verify that the application compiles.

## Requirements

| Tool | Version | Required | Why |
|---|---|---|---|
| **Bun** | >= 1.4 | Yes | Installs dependencies and runs builds; ARDOR uses Bun across all packages |
| **REST API** | Any | Yes | Backing API for data and authentication; an IGNIS backend or `examples/5-mins-qs/api/server.ts` |
| **Browser** | - | - | Packages build with `target: ESNext` and `lib: ESNext, DOM, DOM.Iterable` (`packages/kernel/tsconfig.json`); ARDOR states no older browser floor |
| **VS Code** | Latest | Optional | Recommended editor setup with Oxc and ESLint extensions |

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

Everything after `@venizia/ardor` is a peer dependency so your application controls a single instance of React, `ra-core`, TanStack Query, and the IGNIS packages. Duplicate copies of these libraries break React context and inversion-of-control container resolution.

## Step 4: Configure TypeScript for Decorators

ARDOR uses `@venizia/ignis-inversion` for dependency injection, which requires legacy decorators and metadata reflection. Merge these options into the `compilerOptions` of your `tsconfig.app.json`:

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
  }
}
```

## Step 5: Verify Your Setup

Check that TypeScript compiles without errors and that Vite produces a production build:

```bash
bunx tsc --noEmit -p tsconfig.app.json
bun run build
```

The `-p tsconfig.app.json` flag targets the file edited in step 4. Both commands must exit with code 0.

Next: [5-minute quickstart](./5-minute-quickstart)
