# ARDOR Docs - Design System

The single source of truth for how the ARDOR documentation site looks. Every value is
grounded in an established standard, not chosen by feel. Tokens live in
[`site/.vitepress/theme/design-tokens.css`](./site/.vitepress/theme/design-tokens.css)
and are applied live in the VitePress theme (`site/.vitepress/theme/style.css`).

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

ARDOR uses the devglow **Tide** palette ("still water"): sea-glass, slate and fog over deep water,
with one flush of coral. IGNIS is devglow Sage and VULCAN is Amber; the design system is the same
(one brand, one light accent for links, two decorators, a display gradient, a glow). Brand anchor
is **`#2B6B6A`**, Tide TEAL `#6FB0AE` darkened for fills. Contrast measured with the WCAG 2.1
formula against the dark background `#07090b` (Tide BACKGROUND).

| Token | Hex | Contrast (dark bg) | Rating | Use |
| --- | --- | --- | --- | --- |
| `text` | `#d5dee0` | 14.58:1 | AAA | Body, headings (Tide FOREGROUND) |
| `text-2` | `#b4c0c4` | 10.71:1 | AAA | Secondary body, lede |
| `text-3` | `#8e9ca3` | 7.06:1 | AAA | Smallest readable muted |
| `faint` | `#66727c` | 4.05:1 | ⚠️ large-only | ≥24px / decorative **only** (Tide DARK_04) |
| **brand** | `#2b6b6a` | 3.24:1 | ⚠️ fill/large | Button fills, large accents |
| brand-lt | `#6fb0ae` | 8.07:1 | AAA | **Links / accent text (dark)** (Tide TEAL) |
| teal | `#7fb0a6` | 8.23:1 | AAA | Eyebrow, code decorators, gradient middle (Tide GREEN) |
| aqua | `#88a8c2` | 8.00:1 | AAA | Accent, code keywords, gradient end (Tide SKY) |

The display gradient runs `brand -> teal -> aqua`: from depth to the surface. The glow adds a
faint Tide GOLD `#d0bc88` at the top right.

### Hard rules (these prevent real bugs)

1. **Primary button** = `--ar-primary` (`#2b6b6a`) with **white** text → 6.15:1 AA.
   Dark text on brand fails (3.24:1).
2. **Accent text** is theme-dependent: dark theme → `brand-lt #6fb0ae` (8.07:1);
   light theme → `brand #2b6b6a` (6.15:1 on white; `brand-lt` is only 2.47:1 on white - fails).
3. **`#2b6b6a` is never small body text on dark** (3.24:1). Fills & large accents only.
4. **`faint` is never essential body text** - large or decorative only.
5. **Prose width caps at `--ar-measure` (70ch)**; lede at 62ch.
6. Gradients (`--ar-gradient`) are for **large display text only** (≥39px), where the 3:1
   large-text threshold applies.

## How to use

```ts
// site/.vitepress/theme/index.ts
import './design-tokens.css'   // FIRST - defines tokens + VitePress var mapping
import './style.css'           // component + brand theming, consuming var(--ar-*)
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
