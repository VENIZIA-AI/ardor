# Design Tokens — Figma → Code pipeline (F5)

This folder is the **source of truth for design tokens in code**, exported from the
Figma **Foundations** (Figma Variables) in the [W3C DTCG](https://www.designtokens.org/tr/2025.10/format/)
format. It feeds Tailwind CSS v4 via generated CSS custom properties.

```
Figma Variables  ──(export)──►  tokens/*.json (DTCG)  ──(bun run tokens:build)──►  src/styles/tokens.generated.css  ──►  Tailwind @theme
     design side (manual)              committed source                    automated build (this repo)             consumed by components
```

## Files (DTCG source)

| File | Contents |
|------|----------|
| `primitives.json` | Immutable raw colours — Tailwind ramps + custom (taupe/mauve/mist/olive), `color.<ramp>.<step>` |
| `semantic.light.json` / `semantic.dark.json` | Semantic roles (`primary`, `background`, `success`, …) aliased to primitives, per mode |
| `scales.json` | radius, space, border, breakpoint, text, font-weight, opacity, z, duration, ease, aspect, icon-size, grid |

## Build

```bash
bun run tokens:build
```

Generates `src/styles/tokens.generated.css` (do **not** hand-edit it):

- `:root` — primitives (`--color-*`) + semantic light (`--primary: var(--color-blue-600)`, …)
- `.dark` — semantic dark overrides
- `@theme inline` — semantic → Tailwind utilities (`--color-primary: var(--primary)` → `bg-primary`, …)
- `@theme` — static scales (`--radius-md`, `--text-base`, `--breakpoint-md`, …)

`src/styles/default.css` imports it before `themes.css`.

## Refreshing from Figma (the manual half)

The Figma **local variables** REST API is Enterprise-only, so the export step is design-side:

1. In Figma, edit the Foundations **Variables** (source of truth for design).
2. Export the variable collections to this folder as DTCG JSON — via the **Tokens Studio** plugin
   (Export → Design Tokens / W3C), or the **Figma Dev Mode MCP** (`get_variable_defs` / a
   `use_figma` read script), keeping the same file/shape as above.
3. Run `bun run tokens:build` and commit both `tokens/*.json` and the regenerated CSS.

## Notes

- The JSON is DTCG-standard, so you can swap the lightweight `scripts/build-tokens.mjs`
  for **Style Dictionary** (`+ @tokens-studio/sd-transforms`) without changing the source files.
- Primitives are **immutable / single-mode** — the light/dark switch lives in the semantic layer
  (see `docs/foundations-blueprint.md`).
- Base UI is headless (ships no tokens); these tokens are the app's own system.
