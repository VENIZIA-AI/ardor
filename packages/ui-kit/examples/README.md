# Tokens × Tailwind — live example

A runnable demo proving the design tokens drive real UI through Tailwind v4 utilities,
with live **dark mode** and **accent palette** switching.

## Run

```bash
# from packages/ui-kit
bun run tokens:build     # (re)generate src/styles/tokens.generated.css from tokens/*.json
bun run example:build    # compile examples/tokens.css -> examples/tokens.build.css (Tailwind v4)
# then serve the folder and open examples/index.html
python3 -m http.server 8137   # http://localhost:8137/examples/index.html
```

## What it shows

- **Buttons** (primary / secondary / outline / ghost / destructive; sizes) — `bg-primary text-primary-foreground rounded-md`, etc.
- **Status colours** — `bg-success`, `bg-warning`, `bg-info`, `bg-destructive` (all WCAG-safe with white text).
- **Form + Card** — `bg-card`, `border-border`, `text-muted-foreground`, `focus:ring-ring`, `rounded-xl`, `shadow-md`.
- **Radius / spacing** — `rounded-none…rounded-full`, `p-6`, `gap-3`.
- **Cheatsheet** — token → Tailwind class → live preview swatch.
- **Switcher** (top-right): toggle `.dark` and pick a `.theme-*` accent palette on `<html>`; every token-driven element updates.

Every class here resolves to a CSS variable from `tokens.generated.css` — the same variables
exported from the Figma Foundations. Edit Figma → `tokens:build` → `example:build` → refresh.
