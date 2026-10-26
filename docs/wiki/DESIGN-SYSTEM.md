# ARDOR Docs - Design System

The single source of truth for how the ARDOR documentation site looks. Every value is
grounded in an established standard, not chosen by feel. Tokens live in
[`site/.vitepress/theme/design-tokens.css`](./site/.vitepress/theme/design-tokens.css)
and are applied live in the VitePress theme (`site/.vitepress/theme/style.css`).

The look of the header, sidebar, doc content, callouts and code blocks is not set here: it is the shared
Venizia theme in `site/.vitepress/theme/shared/` (a byte-identical copy of VULCAN's, never edited in this
repository), and ARDOR adds only its accent in `site/.vitepress/theme/product.css`. The `--ar-*` tokens
below are the primitives of the home page and the page components.

## Principles

| Axis | Standard | Value |
| --- | --- | --- |
| Body size | Browser default / longform readability | **16px** base |
| Type scale | Modular scale - Major Third (Material Design) | **ratio 1.25** |
| Spacing | 8-point grid + 4px half-step | `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96` |
| Contrast | WCAG 2.1 AA | **4.5:1** normal · **3:1** large/UI |
| Measure | Bringhurst / Baymard (50-75 CPL, 66 ideal) | prose **≤ 70ch** |
| Line-height | Readability for ~70ch lines | body **1.6**, headings 1.15-1.3 |
| Alignment | Constant left edge aids reading | left-aligned prose |

## Type scale (16 × 1.25ⁿ)

| Token | px / rem | line-height | Use |
| --- | --- | --- | --- |
| `--ar-fs-hero` | 61 / 3.8125 | 1.05 | Hero headline (desktop) |
| `--ar-fs-display` | 49 / 3.0625 | 1.1 | Big marketing display |
| `--ar-fs-h1` | 39 / 2.4375 | 1.15 | Page title |
| `--ar-fs-h2` | 31 / 1.9375 | 1.2 | Section heading |
| `--ar-fs-h3` | 25 / 1.5625 | 1.25 | Subsection |
| `--ar-fs-h4` | 20 / 1.25 | 1.3 | Card / minor heading |
| `--ar-fs-lede` | 18 / 1.125 | 1.6 | Intro paragraph |
| `--ar-fs-body` | 16 / 1 | 1.6 | **Base body / docs prose** |
| `--ar-fs-sm` | 14 / 0.875 | 1.5 | Secondary, tables, inline code |
| `--ar-fs-caption` | 12 / 0.75 | 1.4 | Labels, captions, badges |

## Color - WCAG-verified

ARDOR uses the devglow **Tide** palette ("still water") without its teal: blues over deep water, the
colours of the icon (`#0091EA`, `#7DF3FF`). IGNIS is devglow Sage and VULCAN is Amber; the design
system is the same (one brand, one light accent for links, a decorator, a display gradient, a glow).
Brand anchor is **`#0277BD`**. Contrast measured with the WCAG 2.1 formula against the dark
background `#07090b` (Tide BACKGROUND).

| Token | Hex | Contrast (dark bg) | Rating | Use |
| --- | --- | --- | --- | --- |
| `text` | `#d5dee0` | 14.58:1 | AAA | Body, headings (Tide FOREGROUND) |
| `text-2` | `#b4c0c4` | 10.71:1 | AAA | Secondary body, lede |
| `text-3` | `#8e9ca3` | 7.06:1 | AAA | Smallest readable muted |
| `faint` | `#66727c` | 4.05:1 | ⚠️ large-only | ≥24px / decorative **only** (Tide DARK_04) |
| **brand** | `#0277bd` | 4.16:1 | ⚠️ fill/large | Button fills, large accents |
| brand-deep | `#01579b` | - | - | **Links / accent text (light)** (7.40:1 on white), button hover |
| brand-lt | `#38bdf8` | 9.31:1 | AAA | **Links / accent text (dark)**, code decorators |
| aqua | `#7df3ff` | 15.32:1 | AAA | Code keywords, gradient end (dark surfaces only) |

`--ar-accent` is the accent text colour (eyebrow, labels, tip title): `brand-deep` in the light theme,
`brand-lt` in the dark one. There is no teal token. The display gradient runs
`#0091EA -> #38bdf8 -> #7df3ff`. The glow adds a faint Tide GOLD `#d0bc88` at the top right.

### Hard rules (these prevent real bugs)

1. **Primary button** = `--ar-primary` (`#0277bd`) with **white** text → 4.80:1 AA.
   Dark text on brand fails.
2. **Accent text** is theme-dependent: dark theme → `brand-lt #38bdf8` (9.31:1);
   light theme → `brand-deep #01579b` (7.40:1 on white, 6.81:1 on the `#f3f6f7` surface; `brand`
   is 4.80:1 on white but 4.42:1 on the surface - fails AA there; `brand-lt` is only 2.14:1 on
   white and `aqua` 1.30:1).
3. **`#0277bd` is never small body text on dark** (4.16:1). Fills & large accents only.
4. **`faint` is never essential body text** - large or decorative only.
5. **Prose width caps at `--ar-measure` (70ch)**; lede at 62ch.
6. Gradients (`--ar-gradient`) are for **large display text only** (≥39px), where the 3:1
   large-text threshold applies.

## How to use

```ts
// site/.vitepress/theme/index.ts
import './shared/tokens.css'   // the shared Venizia tokens and fonts
import './product.css'         // ARDOR's accent, the only product-specific value of the shared theme
import './design-tokens.css'   // the --ar-* primitives of the home page and the page components
import './style.css'           // those components, consuming var(--ar-*)
import './shared/vp-map.css'   // maps the tokens onto the VitePress variables, after the above
```

```css
.my-card {
  padding: var(--ar-s5);                 /* 24px */
  border-radius: var(--ar-r-md);         /* 12px */
  border: 1px solid var(--ar-border);
  color: var(--ar-text-2);
  font-size: var(--ar-fs-body);
  line-height: var(--ar-lh-body);
}
.my-card a { color: var(--ar-link); }    /* theme-correct, AA-safe */
```

## Sources

- [WCAG 2.1 - Contrast (W3C)](https://www.w3.org/TR/WCAG21/) · [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Modular type scaling](https://www.kalamuna.com/blog/modular-type-scaling-frontend-developers)
- [Spacing, grids & layouts (Design Systems)](https://www.designsystems.com/space-grids-and-layouts/)
- [Optimal line length (Baymard)](https://baymard.com/blog/line-length-readability) · [UXPin](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/)
