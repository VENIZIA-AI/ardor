# Ardor — Export Design Tokens (Figma plugin)

A tiny in-Figma plugin that reads your local **Variables** and downloads the DTCG token files
this repo expects. **No agent, no Enterprise API.** Works on any Figma plan.

## Install (once)

1. Figma desktop → menu **Plugins → Development → Import plugin from manifest…**
2. Pick `packages/ui-kit/figma-plugin/manifest.json`.

(It now appears under Plugins → Development → *Ardor — Export Design Tokens*.)

## Use (every time you change variables)

1. Open the Figma file with the design-system Variables.
2. **Plugins → Development → Ardor — Export Design Tokens.**
3. Click **↓ Download all 6 files** (or download them individually):
   `primitives.json`, `semantic.light.json`, `semantic.dark.json`, `palette.json`, `scales.json`, `component.json`.
4. Move the downloaded files into `packages/ui-kit/tokens/` (overwrite).
5. Build:
   ```bash
   cd packages/ui-kit
   bun run tokens:build
   ```
   → regenerates `src/styles/tokens.generated.css`. Commit the `tokens/*.json` + the CSS.

## What it reads

Variable collections → files (same mapping as `scripts/figma-export.js`):
Primitives → `primitives.json` · Semantic (Light/Dark) → `semantic.light/dark.json` ·
Palette → `palette.json` · Spacing/Radius/Border/Breakpoints/Opacity/Z-Index/Motion/Typography/Aspect/Grid/Icon → `scales.json` ·
Component → `component.json`.

Collection **names must match** the ones above (the plugin looks them up by name). Shadows are
Figma **effect styles**, not variables — not exported here.

## Notes

- The plugin logic mirrors `scripts/figma-export.js` (the agent path) — both produce identical files.
- Colours: primitives export as hex; semantic/palette/component export as **aliases** (`{color.blue.600}`),
  resolved through the default **Blue** accent theme for `primary`.
