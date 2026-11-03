# ARDOR Docs - Design System

How the ARDOR documentation site looks, and the few rules that keep it readable. The look of the header,
sidebar, doc content, callouts and code blocks is the shared Venizia theme in
`site/.vitepress/theme/shared/` (a byte-identical copy of VULCAN's, never edited in this repository). ARDOR
adds three small things on top of it:

| File | What it holds |
| --- | --- |
| [`site/.vitepress/theme/product.css`](./site/.vitepress/theme/product.css) | ARDOR's accent: the blue the shared theme uses for links, buttons and decorators |
| [`site/.vitepress/theme/design-tokens.css`](./site/.vitepress/theme/design-tokens.css) | the brand ramp `product.css` takes its values from |
| [`site/.vitepress/theme/style.css`](./site/.vitepress/theme/style.css) | the two page components only ARDOR has: the guide cards (`.guide-card`) and the roadmap (`.roadmap-stage`) |

The home page is the shared `HomeLayout.vue` with ARDOR's words in `site/.vitepress/theme/home-content.ts`.

## Color

ARDOR uses the devglow **Tide** palette ("still water") without its teal: blues over deep water, the
colours of the icon (`#0091EA`, `#7DF3FF`). IGNIS is devglow Sage and VULCAN is Amber; the structure is the
same (one brand, one light accent for links). The brand anchor is **`#0277BD`**. Contrast is measured with
the WCAG 2.1 formula (4.5:1 for normal text, 3:1 for large text and UI).

| Token | Hex | Contrast | Use |
| --- | --- | --- | --- |
| `--ar-brand` | `#0277bd` | 4.80:1 under white text, 4.16:1 on the dark background | Button fills and large accents |
| `--ar-brand-deep` | `#01579b` | 7.40:1 on white | Links and accent text in the light theme, button hover |
| `--ar-brand-lt` | `#38bdf8` | 9.31:1 on the dark background | Links and accent text in the dark theme |

### Hard rules

1. A **primary button** is the brand fill with **white** text (4.80:1). Dark text on the brand fails.
2. **Accent text** depends on the theme: dark theme `--ar-brand-lt`, light theme `--ar-brand-deep`.
   `--ar-brand` is 4.80:1 on white but 4.42:1 on the light surface (`#f3f6f7`), which fails AA there.
3. `#0277bd` is never small body text on the dark background (4.16:1): fills and large accents only.
4. Add a token only when a rule uses it. A token nothing reads is dead weight that still has to be kept
   in step with this page.

## Sources

- [WCAG 2.1 - Contrast (W3C)](https://www.w3.org/TR/WCAG21/) · [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
