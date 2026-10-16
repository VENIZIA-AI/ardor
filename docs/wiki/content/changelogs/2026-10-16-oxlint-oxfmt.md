---
title: ARDOR lints with oxlint and formats with oxfmt
description: The ARDOR repository moves from ESLint and Prettier to oxlint and oxfmt, with every preset taken from @venizia/dev-configs. Nothing changes for an application that uses ARDOR.
---

# Changelog - 2026-10-16

## ARDOR lints with oxlint and formats with oxfmt

<Badge type="tip" text="Enhancement" />

**In one line.** Every project in the repository lints with oxlint, keeps ESLint for the naming rule only, and formats with oxfmt, all configured from `@venizia/dev-configs`.

```typescript
// packages/react/.configs/oxlint.config.mts
import { defineConfig } from 'oxlint';
import { ReactOxlintConfigs } from '@venizia/dev-configs/linters';

export default defineConfig(ReactOxlintConfigs.create());
```

## What changed

- **oxlint replaces ESLint for linting.** `react` and `admin` use `ReactOxlintConfigs`; `kernel`, `ardor` and the examples use `oxlintConfigs` plus the secure-context rule. Type-aware rules such as `no-floating-promises` run through `oxlint-tsgolint`.
- **ESLint stays for one rule.** `@typescript-eslint/naming-convention` has no oxlint port, so ESLint runs it alone.
- **oxfmt replaces Prettier.** The output keeps ARDOR's style: parentheses on every arrow parameter, and the closing `>` of a JSX tag on its last attribute line.
- **Every project owns a `.configs/` folder** with `oxlint.config.mts`, `oxfmt.config.mts` and `eslint.config.mjs`. The ESLint config is plain JavaScript, so ESLint loads it without `jiti`. `tsconfig.json` stays at the project root.
- **ARDOR keeps no lint rule of its own.** `scripts/eslint/react.mjs` and `scripts/eslint/secure-context.mjs` are gone: the React preset in `@venizia/dev-configs` is now as strict as ARDOR's was, and the `crypto.randomUUID` ban lives there as `NoRestrictedPropertiesRule`.
- **A warning fails lint.** oxlint runs with `--deny-warnings`.

## Who is affected

- **Applications that use ARDOR.** No action needed. The published packages and their API are unchanged.
- **Contributors to the ARDOR repository.** `make lint`, `make lint-<pkg>` and `bun run lint:fix` work as before, on the new tools. The `.prettierrc.mjs`, `.prettierignore` and `eslint.config.mjs` files are gone. Every tool call passes `-c` with its `.configs/` file.

## Details

- **Format drift.** `scripts/` and `docs/wiki` used the shared Prettier preset, which drops arrow parentheses. They now follow the ARDOR style like the packages, so they were reformatted once. `docs/wiki/site/.vitepress/config.mts` is formatted for the first time.
- **Stricter type imports.** oxlint reports a type-only import inside a decorated class, which the ESLint rule skipped. Three `admin` providers now import `Container` and `DefaultAuthService` as types. Injection is unaffected: the container resolves by key and never reads the emitted parameter types.
- **Ignore patterns.** A pattern written inside `.configs/` resolves against `.configs/`. `dist` and `node_modules` are skipped through `.gitignore`.

| File | Package |
|------|---------|
| `.configs/*.config.{mts,mjs}` | every package, example and `docs/wiki` |
| `src/providers/auth.ts`, `i18n.ts`, `rest-data.ts` | admin |
| `Makefile` (`lint-scripts`) | repository |
