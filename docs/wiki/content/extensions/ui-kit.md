---
title: UI kit
description: "@venizia/ardor-ui-kit: Tailwind CSS v4 theme, design tokens generated from Figma, and shadcn-style components - install, CSS setup, dark mode, and the component families it ships."
---

# UI kit

`@venizia/ardor-ui-kit` is the component and styling package of ARDOR. It ships a Tailwind CSS v4 theme, CSS custom properties generated from Figma design tokens, and a set of shadcn-style components built on a headless primitive library. The kit is optional - the core packages do not depend on it.

## Prerequisites

An app with Tailwind CSS v4 and a main CSS file (for example `index.css`) that Tailwind processes.

## Quick Reference

| Module (from the generated index) | What it holds |
|---|---|
| `components/core/adaptive/*` | `AdaptiveDialog*`, `AdaptivePopover*` - dialog and popover that adapt to the viewport |
| `components/core/backdrop`, `components/core/common` | `Backdrop`, `ComingSoon` |
| `components/core/input/*` | `CheckboxInput`, `DatePicker`, `SwitchInput`, `TextField` |
| `components/icons/*` | `akar-icons-check-box-fill`, `akar-icons-circle-check-fill` |
| `components/shadcn/*` | accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, button-group, calendar, card, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty, field, input, input-group, kbd, label, popover, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, sonner, spinner, switch, table, tabs, textarea, tooltip |
| `hooks/use-mobile` | Viewport hook |
| `utilities/tw.utility` | Tailwind class utility |
| `styles/default.css` | Default theme entry - imports the generated tokens, then `themes.css` |

## Install

```bash
npm install @venizia/ardor-ui-kit
```

## CSS setup

Two steps in your main CSS file.

### 1. Import the default theme

`styles/default.css` is the theme entry. It imports the generated token file first and `themes.css` after it. The default type scale uses Inter, so the reference setup loads the font before the theme:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
@import '@venizia/ardor-ui-kit/styles/default.css';
```

### 2. Register the package as a Tailwind source

Tailwind v4 only generates utilities for files it scans. Point it at the installed package so the classes used inside the kit's components are emitted. The path is relative to your CSS file:

```css
@source '../node_modules/@venizia/ardor-ui-kit';
```

A complete `index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
@import '@venizia/ardor-ui-kit/styles/default.css';

@source '../node_modules/@venizia/ardor-ui-kit';
```

## Design tokens

The kit's colours and scales are not hand-written. They come from the Figma **Foundations** variables, exported as W3C DTCG JSON, and built into a CSS file:

```
Figma Variables -> tokens/*.json (DTCG) -> bun run tokens:build -> src/styles/tokens.generated.css -> Tailwind @theme
```

Source files:

| File | Contents |
|---|---|
| `primitives.json` | Immutable raw colours - Tailwind ramps plus custom ramps (taupe, mauve, mist, olive), as `color.<ramp>.<step>` |
| `semantic.light.json` / `semantic.dark.json` | Semantic roles (`primary`, `background`, `success`, ...) aliased to primitives, one file per mode |
| `scales.json` | radius, space, border, breakpoint, text, font-weight, opacity, z, duration, ease, aspect, icon-size, grid |

`bun run tokens:build` generates `src/styles/tokens.generated.css` with four blocks:

- `:root` - primitives (`--color-*`) and the semantic light values, for example `--primary: var(--color-blue-600)`
- `.dark` - semantic dark overrides
- `@theme inline` - semantic variables mapped to Tailwind utilities, for example `--color-primary: var(--primary)` which yields `bg-primary`
- `@theme` - static scales such as `--radius-md`, `--text-base`, `--breakpoint-md`

Primitives are single-mode. The light/dark switch lives entirely in the semantic layer. The headless primitive library ships no tokens of its own - these tokens are the app's whole design system.

Because the semantic layer is exposed through `@theme inline`, you use the roles as ordinary Tailwind utilities:

```css
.panel {
  @apply bg-background text-foreground rounded-md;
}
```

### Refreshing tokens from Figma

The Figma local-variables REST API is Enterprise-only, so the export is a manual, design-side step:

1. Edit the Foundations variables in Figma.
2. Export the collections as DTCG JSON into `tokens/` with the same files and shape - via the Tokens Studio plugin (Export -> Design Tokens / W3C) or the Figma Dev Mode MCP (`get_variable_defs` or a `use_figma` read script).
3. Run `bun run tokens:build` and commit both `tokens/*.json` and the regenerated CSS.

The JSON is standard DTCG, so the small `scripts/build-tokens.mjs` can be replaced by Style Dictionary with `@tokens-studio/sd-transforms` without touching the source files.

## Dark mode and themes

Dark mode is class-based. Adding `dark` to an ancestor (usually `<html>`) swaps the semantic variables to the values from `semantic.dark.json`. Primitives do not change.

```css
/* generated - shape only */
:root {
  --primary: var(--color-blue-600);
}
.dark {
  --primary: var(--color-blue-400);
}
```

```tsx no-check
// toggle by adding or removing the class on the root element
document.documentElement.classList.toggle('dark');
// ...
```

`default.css` loads `themes.css` after the generated tokens, so any palette overrides defined there take precedence over the defaults.

## Components

Everything in the generated index is re-exported from the package root, so one import path covers all families.

### Adaptive components

`AdaptiveDialog` and `AdaptivePopover` follow the shadcn composition pattern - a root, a trigger, a content container, and header/title/description/close parts:

```tsxx
import {
  AdaptiveDialog,
  AdaptiveDialogTrigger,
  AdaptiveDialogContent,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
  AdaptiveDialogDescription,
  AdaptiveDialogClose,
} from '@venizia/ardor-ui-kit';

export function DeleteProductDialog() {
  return (
    <AdaptiveDialog>
      <AdaptiveDialogTrigger>Delete</AdaptiveDialogTrigger>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Delete product</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>This cannot be undone.</AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        {/* ... */}
        <AdaptiveDialogClose>Cancel</AdaptiveDialogClose>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}
```

### Core inputs

`TextField`, `CheckboxInput`, `SwitchInput`, and `DatePicker` are the kit's own form controls, layered over the shadcn primitives (`input`, `checkbox`, `switch`, `calendar`).

```tsx no-check
import { TextField, CheckboxInput, SwitchInput, DatePicker } from '@venizia/ardor-ui-kit';
// ...
```

### shadcn family

The `components/shadcn/*` modules are shadcn-style components. They export the usual composed parts, for example accordion. The `Accordion` root requires a `type` prop - `"single"` or `"multiple"` - because its props are a union of the two modes:

```tsxx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@venizia/ardor-ui-kit';

export function Faq() {
  return (
    <Accordion type="single">
      <AccordionItem value="shipping">
        <AccordionTrigger>Shipping</AccordionTrigger>
        <AccordionContent>{/* ... */}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

### Misc

- `Backdrop`, `ComingSoon` - layout helpers
- `akar-icons-check-box-fill`, `akar-icons-circle-check-fill` - the two bundled icons
- `hooks/use-mobile` - a viewport hook used by the adaptive components
- `utilities/tw.utility` - the Tailwind class-merging utility used inside the kit

## Common pitfalls

- **Missing `@source`.** If the package is not registered as a Tailwind source, utilities used inside the kit's components are never generated and components render unstyled.
- **Wrong `@source` path.** The path is resolved relative to the CSS file. `../node_modules/...` assumes your CSS lives one directory below the project root; adjust it otherwise.
- **Editing `tokens.generated.css`.** It is build output. Edit `tokens/*.json` (or Figma, then export) and run `bun run tokens:build`.
- **Changing primitives to get a dark variant.** Primitives are single-mode. Put mode-specific values in `semantic.dark.json`.
- **Importing the theme after Tailwind's own layers.** Import `styles/default.css` from your main CSS entry so its `@theme` blocks are part of the same Tailwind build.
- **`Accordion` without `type`.** The root does not compile without `type="single"` or `type="multiple"`.

## Related

- [Quickstart](../guides/get-started/quickstart)
- [Hooks](../references/hooks)
- [Application](../references/application)
- [Socket client](./socket-client)
- [Count provider](./count-provider)
- [Custom transport](./custom-transport)
