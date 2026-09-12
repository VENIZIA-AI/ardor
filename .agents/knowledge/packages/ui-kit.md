---
type: Package
title: ui-kit
description: A standalone Tailwind/Radix/shadcn component library with Figma-derived design tokens, published as @venizia/ardor-ui-kit and consumed independently of the framework packages.
resource: packages/ui-kit
tags: [ui-kit, tailwind, radix, shadcn, design-tokens, figma, package]
---

## What it is

`@venizia/ardor-ui-kit` is ARDOR's component and design-token library: Tailwind CSS v4 + Radix primitives wrapped into shadcn-style components, with a theme generated from Figma variables. It ships as its own npm package and is **not** part of the ARDOR application framework stack - it has no dependency on `@venizia/ardor-kernel`, `@venizia/ardor-react`, or `@venizia/ardor-admin`, and none of them depend on it either. See [monorepo layout](/overview/monorepo-layout.md) for where it sits among the other packages, and compare with [kernel](/packages/kernel.md), [react](/packages/react.md), [admin](/packages/admin.md) and the [ardor](/packages/ardor.md) meta-package, which form the actual app framework.

## Consuming it

Install as a normal dependency:

```bash
npm install @venizia/ardor-ui-kit
```

Then wire it into the app's CSS entry point (e.g. `index.css`):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
@import '@venizia/ardor-ui-kit/styles/default.css';
```

And tell Tailwind where to find the kit's source files so its utility classes get picked up:

```css
@source '../node_modules/@venizia/ardor-ui-kit';
```

Package exports (`package.json`): the main entry `.` resolves to `dist/index.js` / `dist/index.d.ts`; `./styles/*` exposes the raw CSS files directly from `src/styles`. CSS files are marked as `sideEffects`, so bundlers won't tree-shake them away.

## Design tokens: the Figma → code pipeline

The kit's tokens are the source of truth for colors, spacing, radii, and other scale values, authored in Figma and exported to code rather than hand-written. The flow is:

```
Figma Variables ──export──► tokens/*.json (DTCG) ──bun run tokens:build──► src/styles/tokens.generated.css ──► Tailwind @theme
```

Token source files, all in DTCG (W3C Design Tokens) JSON format:

- `primitives.json` - immutable raw color ramps (Tailwind ramps plus custom taupe/mauve/mist/olive), keyed `color.<ramp>.<step>`.
- `semantic.light.json` / `semantic.dark.json` - semantic roles (`primary`, `background`, `success`, etc.) aliased to primitives, one file per mode.
- `scales.json` - non-color scales: radius, space, border, breakpoint, text, font-weight, opacity, z, duration, ease, aspect, icon-size, grid.

Running `bun run tokens:build` regenerates `src/styles/tokens.generated.css` - this file must never be hand-edited. It contains:

- `:root` - primitive `--color-*` variables plus semantic light aliases (e.g. `--primary: var(--color-blue-600)`).
- `.dark` - semantic dark-mode overrides.
- `@theme inline` - semantic-to-Tailwind utility mapping (`--color-primary: var(--primary)` produces `bg-primary`, etc.).
- `@theme` - static scale values (`--radius-md`, `--text-base`, `--breakpoint-md`, ...).

`src/styles/default.css` imports `tokens.generated.css` before `themes.css`, so the light/dark switch is a semantic-layer concern on top of immutable, single-mode primitives.

Refreshing tokens from Figma is a manual, design-side step (the Figma local-variables REST API is Enterprise-only): a designer edits the Foundations variables in Figma, exports the collections as DTCG JSON via the Tokens Studio plugin or the Figma Dev Mode MCP, and a developer runs `bun run tokens:build` and commits both the updated `tokens/*.json` and the regenerated CSS. Because the format is DTCG-standard, the lightweight `scripts/build-tokens.mjs` build script could be swapped for Style Dictionary without changing the source token files.

## Barrel generation

The package's public API surface is assembled by a generated index rather than a hand-maintained one: `bun run gen:index` runs `src/generate-index.ts` to produce the barrel file that `dist/index.js` is built from. This keeps component exports in sync with what actually exists in `src` as components are added or removed.

## Other scripts

Notable `package.json` scripts: `build` (full package build via `scripts/build.sh`), `clean`, `rebuild` (used by `prepublishOnly`), `lint` / `lint:fix` (eslint + prettier), and `example:build`, which runs the Tailwind CLI directly against `examples/tokens.css` to produce a built example stylesheet for manual token inspection.

## Relationship to the framework

Because ui-kit has no dependency on kernel, react, or admin, it can be version-bumped, built, and published independently - see [build, run, test](/overview/build-run-test.md) and [release and publish](/process/release-publish.md) for the general package release flow that also applies here. Framework packages that render UI (such as [admin](/packages/admin.md)) consume ui-kit the same way any other app would: as an installed dependency providing components and CSS, not as a peer in the DI/lifecycle graph described in [application lifecycle](/architecture/application-lifecycle.md) or [DI in the browser](/architecture/di-in-the-browser.md).
