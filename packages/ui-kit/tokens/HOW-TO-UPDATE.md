# How to update tokens from Figma (the simple way)

You do **not** export by hand. The Figma *local variables* REST API is Enterprise-only, so the
export is driven by an AI agent (Claude Code) through the **Figma Dev Mode MCP**.

## The one thing you do

1. In Figma desktop: **Preferences → enable "Dev Mode MCP Server"** (once).
2. In Claude Code, say (paste your file link):

   > **"Cập nhật design tokens từ Figma: `<figma-file-link>`"**
   > (or: "Re-export the Figma variables into tokens/ and rebuild")

That's it. Claude will:
1. Read every Variable collection from the file (via the Figma MCP).
2. Regenerate the DTCG source files in `tokens/` (see `scripts/figma-export.js`).
3. Run `bun run tokens:build` → `src/styles/tokens.generated.css`.
4. Show you a summary; you review & commit.

## What gets read (so you know what "tokens" means here)

**Variables only** — not pages/frames. Collections → files:

| Figma collection | → file |
|---|---|
| Primitives | `primitives.json` (raw hex) |
| Semantic (Light/Dark) | `semantic.light.json` + `semantic.dark.json` (aliases) |
| Palette (10 themes) | `palette.json` |
| Spacing, Radius, Border, Breakpoints, Opacity, Z-Index, Motion, Typography, Aspect, Grid, Icon | `scales.json` |
| Component | `component.json` (aliases) |
| Shadow effect styles | not variables — kept as effect styles / hand-authored CSS |

## If you prefer no agent (designer self-serve)

Use the **Tokens Studio for Figma** plugin → connect to Variables → **Export → W3C DTCG** →
drop the files into `tokens/` keeping the same names/shape → `bun run tokens:build`.

## Build only (when tokens/*.json already exist)

```bash
cd packages/ui-kit
bun run tokens:build      # tokens/*.json  ->  src/styles/tokens.generated.css
bun run example:build     # optional: rebuild the live demo CSS
```

Never hand-edit `tokens.generated.css` — it is generated.
