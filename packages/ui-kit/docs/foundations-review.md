# Ardor UI Kit — Figma Foundations Review

> **Scope.** A comprehensive, research-backed review of the **Foundations** (design tokens) defined in the team's Figma file, benchmarked against current (2025–2026) best practices, and measured against the code they are meant to feed (`@venizia/ardor-ui-kit`, a React kit on **headless Base UI + Tailwind CSS v4 + shadcn conventions**).
>
> - **Figma file:** `BaseUI` — `yKEc9bB6vjM2ZQb8Hacz0A`
> - **Reviewed:** 9 Variable collections · 449 variables (values resolved per mode via the Figma MCP)
> - **Date:** 2026-07-01
> - **Method:** token values pulled directly from Figma Variables; WCAG contrast computed from resolved hex (WCAG 2.x relative-luminance); best-practice claims verified against primary sources (see [Sources](#sources)).

---

## 1. Executive summary

The foundation is **broad and thoughtfully scoped** — it already covers colour (primitives + semantic + a 10-theme accent palette), typography, radius, spacing and opacity, and it clearly reaches for shadcn/Tailwind token conventions. That's a strong base.

However, several issues would cause **real bugs and accessibility failures** if the tokens were exported and consumed as-is, plus some structural choices that will not scale. In priority order:

| # | Severity | Finding | Area |
|---|----------|---------|------|
| F1 | 🔴 **Critical** | **Primitives are theme-aware** — `Base/White` = `#fff` (Light) / `#000` (Dark); the whole `Slate` ramp and the custom ramps invert 50↔950 between modes. This inverts the industry-standard layering (primitives must be immutable; theming belongs in the semantic layer). | Architecture |
| F2 | 🔴 **Critical** | **Two competing semantic layers.** `Sematic` (single-mode, `primary` = gray `#737373`, has `info/success/warning/outline/surface`) and `Mode` (Light/Dark, `primary` = blue `#3b82f6`). They disagree on `primary` and overlap ~80%. No single source of truth. | Governance |
| F3 | 🔴 **Critical** | **The dedicated `Mode` "Dark" mode is not dark** — `background` resolves to `#f8fafc` (near-white) and `foreground` to `#020617` (near-black) in *both* modes. Dark mode via this collection is broken. | Correctness |
| F4 | 🟠 **High** | **Status colours fail WCAG AA.** `destructive` Red/500 + white = **3.76**, `success` Green/500 = **2.28**, `warning` Amber/500 = **2.15**, `info` Cyan/500 = **2.43**. All below the 4.5:1 bar for button labels. | Accessibility |
| F5 | 🟠 **High** | **Figma ≠ code.** The CSS (`default.css`/`themes.css`) uses its own zinc-based OKLCH values and does **not** consume these variables. The Figma foundation is currently aspirational, not wired. | Parity |
| F6 | 🟡 **Medium** | **Redundant spacing model** — near-identical `padding/*` and `gap/*` scales where one unified spacing scale is the norm. | Structure |
| F7 | 🟡 **Medium** | **Missing token categories** — no elevation/shadow, z-index, border-width, motion (duration/easing), focus-ring, or breakpoint tokens. | Coverage |
| F8 | 🟡 **Medium** | **Mobile type scale collapses named steps** — on Mobile, `text/sm = text/xs = 12`, `text/lg = text/base = 14`, `text/2xl = text/3xl = 20`. Distinct steps become indistinguishable. | Typography |
| F9 | 🟢 **Low** | **Naming quirks** — collection misspelled `Sematic`; duplicate `gap/4xs 2`; radius named `rounded/*` (diverges from Tailwind's `--radius-*`/`rounded-*`); opacity stored `0–100` rather than `0–1`. | Naming |

**Bottom line:** the *content* is largely right (the palettes, the semantic vocabulary, the scales), but the *structure* (where theming lives, which collection is authoritative) and a handful of *values* (status contrast, the broken Dark mode) need correction before this can be a reliable source of truth for code.

---

## 2. What was reviewed

The Foundations are **Figma Variables**, not laid-out frames (the linked node `7-3` is empty; the file's single page holds only a blank cover). The 9 collections:

| Collection | Modes | Vars | Purpose |
|---|---|---|---|
| **Typeface** | Mode 1 | 1 | `heading/family` → `Inter` |
| **Typography** | Desktop / Mobile | 21 | `font-weight/thin…black` (100–900), `text/xs…8xl` |
| **Primitives** | **Light / Dark** | 288 | `Base/White,Black` + Tailwind ramps (Slate…Rose) **+ custom Taupe, Mauve, Mist, Olive**, each 50–950 |
| **Sematic** *(sic)* | Mode 1 | 37 | Semantic roles incl. `outline, surface, info, success, warning` |
| **Mode** | Light / Dark | 32 | A *second* semantic role set |
| **Palette** | Neutral, Red, Orange, Yellow, Green, Teal, Cyan, Blue, Purple, Pink | 20 | Themeable accent: `primary`, `primary-foreground`, `primary-opacity-*`, `primary-50…950` |
| **Corner Radius** | Mode 1 | 9 | `rounded/none…3xl`, `rounded/full` |
| **Spacing** | Value | 25 | `padding/4xs…3xl` + `gap/none…7xl` |
| **Opacity** | Mode 1 | 16 | `op/0…100` |

Full resolved values are in [Appendix A](#appendix-a--resolved-token-values).

---

## 3. Architecture & layering

### Best practice
Every authoritative source converges on a strict, one-directional layering:

**Primitive / reference (immutable, context-free) → Semantic / alias (roles, theming) → Component.**

- **Material Design 3**: fixed tonal palettes (tone `0` is always black, `100` always white) feed *color roles*; **light and dark are delivered at the role layer**, not by changing the palette. ([M3][m3])
- **DTCG format (2025.10)**: primitives are static `$value`s; relationships/DRY come from `{alias}` references; the format itself defines **no built-in light/dark switch**, so theming must be layered on. ([DTCG][dtcg])
- **shadcn/ui**: dark mode overrides the **same semantic tokens** under `.dark` — primitives are never redefined. ([shadcn][shadcn-theme])
- **Radix Colors**: a fixed 12-step scale with fixed semantic roles per step. ([Radix][radix-scale])
- *Counter-example:* **Adobe Spectrum** does bake theme variation into *global* tokens, so this is "off-consensus," not universally forbidden. ([Spectrum][spectrum])

### What this foundation does — 🔴 F1
The **Primitives** layer is theme-aware. Measured directly from Figma:

| Primitive | Light | Dark |
|---|---|---|
| `Base/White` | `#ffffff` | **`#000000`** |
| `Base/Black` | `#000000` | **`#ffffff`** |
| `Slate/50` | `#f8fafc` | `#020617` |
| `Slate/900` | `#0f172a` | `#f1f5f9` |
| `Slate/950` | `#020617` | `#f8fafc` |
| `Slate/500` | `#64748b` | `#64748b` *(midpoint stable)* |
| `Blue/500`, `Red/500` | unchanged | unchanged *(accent hues don't invert)* |

So `Base/White` is a primitive **named "White" that renders black**, and `Slate/900` doesn't denote a fixed colour — it denotes "the 900-slot in the current theme." The custom ramps (Taupe/Mauve/Mist/Olive) invert the same way.

### Why it's risky
1. **Misleading names** — a token literally named `White` that is black in dark mode will confuse every consumer and reviewer.
2. **Breaks tooling/export** — DTCG/Style Dictionary treat primitives as static values; an inverting primitive has no single `$value` and can't round-trip cleanly.
3. **Wrong layer owns theming** — inversion logic is trapped in the raw scale, so the semantic layer can't make deliberate per-role decisions (e.g., "cards get a hair lighter than the page in dark mode," which good dark themes do rather than a flat mathematical invert).

### Recommendation
Make **Primitives immutable** (one mode, real Tailwind values: `Slate/900` is always `#0f172a`). Move the light/dark switch into the **semantic layer** (the `Mode` collection's Light/Dark modes) by aliasing each role to a *different primitive per mode* — e.g. `background → {Base/White}` in Light, `→ {Slate/950}` in Dark. This is exactly the shadcn `:root` / `.dark` model. ([shadcn][shadcn-theme], [M3][m3], [DTCG][dtcg])

---

## 4. Naming & governance

### 🔴 F2 — Two competing semantic collections
`Sematic` and `Mode` are ~80% the same role set but **disagree**:

| Role | `Sematic` (Mode 1) | `Mode` (Light) |
|---|---|---|
| `primary` | `#737373` (neutral gray) | `#3b82f6` (blue) |
| `ring` | `= primary` (gray) | `#3b82f6` (blue) |
| extras | `outline, surface, info, success, warning` | — (none) |
| modes | single (inherits inversion from primitives) | Light / Dark |

Two design-time collections defining `primary` differently is a textbook **competing-source-of-truth** problem. Tooling like Tokens Studio *resolves* same-named conflicts deterministically by set order, but that's a tooling band-aid, not governance — the design intent is still ambiguous. ([Tokens Studio][ts-sets]) A semantic token "stops being semantic when it lacks clear intent and doesn't scale." ([Design Systems Collective][dsc])

**Recommendation:** pick **one** authoritative semantic collection. Recommended: keep **`Mode`** (it has real Light/Dark modes — the right place for theming per F1), **migrate the extras** (`info/success/warning/outline/surface`) into it, then **delete `Sematic`**. Fix the spelling to **`Semantic`** while doing so.

### 🔴 F3 — `Mode`'s "Dark" mode isn't dark
Measured from Figma, the `Mode` collection's **Dark** values:

| Role | Light | Dark |
|---|---|---|
| `background` | `#ffffff` | **`#f8fafc`** (near-white) |
| `foreground` | `#020617` | `#020617` (near-black) |
| `card` | `#ffffff` | `#f1f5f9` (near-white) |
| `primary` | `#3b82f6` | `#3b82f6` |

Dark mode here renders **dark text on a near-white background** — i.e. it looks like Light mode. The Dark mode is unconfigured/broken. (By contrast, `Sematic` *does* produce a working dark theme — but only via the F1 primitive-inversion anti-pattern.) So today, **whichever semantic layer you wire to, dark mode is either broken (`Mode`) or built on the wrong mechanism (`Sematic`)**. Consolidating per F2 fixes both.

### 🟢 F9 — Naming quirks
- **`Sematic`** → rename **`Semantic`**.
- **`gap/4xs 2`** — an accidental duplicate of `gap/4xs`/`padding/4xs` (both `2px`); delete it.
- **`rounded/*`** — Tailwind v4 derives utility names from token names within a namespace, so radius tokens should live in the **`--radius-*`** namespace to map cleanly to `rounded-sm/md/lg`. Naming the Figma scale `rounded/*` invites a mismatch on export. ([Tailwind][tw-theme])
- Ordering nit: `rounded/3xl` (24px) is defined *after* `rounded/full` (9999px).

Benchmark: the EightShapes taxonomy (namespace · object · base[category/concept/property] · modifier[variant/state/scale/mode]) is the reference to align names to. ([EightShapes][es-naming])

---

## 5. Completeness & coverage

### 🟡 F6 — `padding` vs `gap` are redundant
The two scales are near-identical (`padding/sm` = `gap/sm` = 12, `md` = 16, `lg` = 24, `xl` = 32…). Best practice is **one unified spacing scale used for both padding and gaps** — Atlassian ships a single `space.*` system for both, and Tailwind v4 exposes a single `--spacing-*` namespace. ([Atlassian][atl-spacing], [Tailwind][tw-theme]) The split also drifts: `padding` stops at `3xl` (48) while `gap` runs to `7xl` (128).

**Recommendation:** collapse to one `spacing/*` scale (keep the wider range); express "padding" vs "gap" as *usage*, not separate tokens.

### 🟡 F7 — Missing categories
A production foundation for a shadcn/Tailwind kit typically also tokenizes:

| Missing | Why it matters | Evidence |
|---|---|---|
| **Elevation / shadow** | Tailwind v4 has a first-class `--shadow-*` namespace; components need consistent depth. | [Tailwind][tw-theme] |
| **Breakpoints** | Tailwind v4 `--breakpoint-*` drives responsive variants; belongs in tokens. | [Tailwind][tw-theme] |
| **Focus ring** | Radix reserves a scale step specifically for focus rings; it's a distinct semantic slot (you have `ring` colour but no width/offset). | [Radix][radix-scale] |
| **Border width** | Buttons/inputs/dividers need consistent stroke tokens. | (best-practice) |
| **Motion (duration/easing)** | `default.css` already hand-codes collapsible animations; these should be tokens. | (best-practice) |
| **Z-index** | Overlay/popover/tooltip stacking needs a token ladder. | (best-practice) |

*(Shadow/breakpoint/focus-ring are directly source-backed; z-index/border-width/motion are common-practice expectations.)*

### What's good here
Weights (100–900), a full `text/*` ramp, the 10-theme accent Palette, and an opacity scale are all solid and align with Tailwind's namespaces.

---

## 6. Accessibility & colour contrast

### Thresholds (WCAG 2.1/2.2, unchanged in 2.2)
- **4.5:1** normal text · **3:1** large text (≥18pt or 14pt bold) · **3:1** UI components & graphical objects. ([W3C WCAG][wcag], [WebAIM][webaim])

### 🟠 F4 — Measured results (white foreground unless noted)

| Token / pair | Ratio | Verdict |
|---|---:|---|
| `destructive` Red/500 `#ef4444` | **3.76** | ✗ fails normal text (large-only) |
| `success` Green/500 `#22c55e` | **2.28** | ✗ fails |
| `warning` Amber/500 `#f59e0b` | **2.15** | ✗ fails |
| `info` Cyan/500 `#06b6d4` | **2.43** | ✗ fails |
| `Mode` `primary` Blue/500 `#3b82f6` | **3.68** | ✗ fails normal text (large-only) |
| `Sematic` `primary` gray `#737373` | 4.74 | ✓ passes (barely) |
| `muted-foreground` Slate/500 `#64748b` on white | 4.76 | ✓ passes (barely) |
| `foreground` Slate/900 on white | 17.85 | ✓ excellent |

This is the well-known Tailwind/shadcn trap: the `500` step is a **solid fill**, not a text-bearing surface. Radix documents the same rule — only the text steps (11–12) are guaranteed accessible; the solid step (≈500/step-9) is *not*, and several bright hues (Amber, Cyan-like) even need **dark** foreground, not white. ([Radix][radix-scale], [Radix #42][radix42])

### Minimum passing shade (white text, ≥4.5:1) — measured
| Hue | 500 | 600 | 700 | **Min AA step** |
|---|---:|---:|---:|:--|
| Red (destructive) | 3.76 | **4.83** | 6.47 | **600** |
| Blue (primary) | 3.68 | **5.17** | 6.70 | **600** |
| Green (success) | 2.28 | 3.30 | **5.02** | **700** |
| Amber (warning) | 2.15 | 3.19 | **5.02** | **700** |
| Cyan (info) | 2.43 | 3.68 | **5.36** | **700** |

**Recommendation:** for any status/primary colour that carries **white label text**, bind the role to **600** (red, blue) or **700** (green, amber, cyan) — *not* 500. Alternatively pair the 500 fill with **dark** foreground (the Radix approach for bright hues), or reserve 500 for non-text accents (icons/borders, which only need 3:1). Bump `muted-foreground` one step (Slate/600 `#475569`) to leave the 4.5:1 margin comfortably rather than sitting at 4.76.

---

## 7. Standards & tooling / code export

### Intended pipeline (and it's a good one)
**Figma Variables → DTCG tokens → Style Dictionary → CSS custom properties → Tailwind v4 `@theme` / shadcn `@theme inline` → components.** Base UI ships **no tokens of its own** (it's headless), so the app owning 100% of the tokens is exactly right. ([DTCG][dtcg], [Tailwind][tw-theme], [shadcn][shadcn-theme], [shadcn v4][shadcn-v4])

Two practical notes:
- **Tokens Studio export** needs `@tokens-studio/sd-transforms` before Style Dictionary can emit CSS. ([Tokens Studio SD][ts-sd])
- Tailwind v4 utilities are **named by token name within a namespace** — so token names *are* your API. This is why F9's `rounded/*` and the `padding`/`gap` split matter downstream.

### 🟡 F8 — Responsive typography via modes
Encoding sizes with Desktop/Mobile Figma modes is legitimate, but the **Mobile mode collapses distinct steps to the same value**: `text/sm = text/xs = 12`, `text/lg = text/base = 14`, `text/2xl = text/3xl = 20`. Two named steps resolving to one value means components using them become visually identical on mobile — the scale loses information. Consider **fluid `clamp()`** for the body range (removes most of the Mobile duplication) and reserve discrete mode overrides for display sizes. *(Inferential — lower confidence; no single source names this exact case.)*

### 🟢 Opacity stored `0–100`
`op/*` holds `0, 5, … 100`. CSS `opacity` and Tailwind opacity modifiers expect `0–1` (or `%`). Store as **`0–1`** (or transform on export) so values drop straight into CSS without a ×0.01 step. *(Inferential — lower confidence.)*

---

## 8. Figma ↔ code parity (🟠 F5)

The current CSS **does not consume these variables**. `packages/ui-kit/src/styles/default.css` hardcodes its own **OKLCH, zinc-based** semantic set (`--primary: oklch(0.21 …)`), a `--radius: 0.625rem` scale, `--spacing: 4px`, and `themes.css` defines 10 `.theme-*` classes. Divergences:

| Aspect | Figma | Code (`default.css`) |
|---|---|---|
| Colour space | sRGB hex | OKLCH |
| `primary` | gray `#737373` **or** blue `#3b82f6` (F2) | zinc `oklch(0.21 …)` |
| Radius | fixed px `rounded/2…24` | `0.625rem` base + `calc()` `sm/md/lg/xl` |
| Spacing | `padding/*` + `gap/*` (px) | single `--spacing: 4px` |
| Status roles | `info/success/warning` present | **absent** |
| Accent themes | Palette: Neutral, Red, Orange, Yellow, Green, Teal, Cyan, Blue, Purple, Pink | `.theme-*`: blue, green, amber, rose, purple, orange, teal, red, yellow, violet |

Even the theme *sets* differ (Figma has Cyan/Neutral; code has amber/rose/violet). **Until an export pipeline is wired (F5 + §7), the Figma foundation is documentation, not the running source of truth.** Interestingly, the code's single `--spacing` + `calc()` radius is *closer to best practice* than Figma's split scales — so reconciliation should flow **both** ways, not just Figma→code.

---

## 9. Prioritized recommendations

**P0 — correctness & a11y (do first)**
1. **Fix status/primary contrast** (F4): bind text-bearing roles to 600 (red/blue) or 700 (green/amber/cyan), or use dark foreground on 500.
2. **Repair dark mode** (F3): configure real Dark values in the authoritative semantic collection.
3. **Pick one semantic collection** (F2): keep `Mode`, fold in `info/success/warning/outline/surface`, delete `Sematic`.

**P1 — structure**
4. **Make Primitives immutable** (F1): drop Light/Dark from Primitives; move theming to the semantic Light/Dark modes via per-mode aliases.
5. **Wire an export pipeline** (F5/§7): DTCG → Style Dictionary → CSS vars → Tailwind `@theme inline`, so code consumes Figma.
6. **Unify spacing** (F6): one `spacing/*` scale.

**P2 — coverage & hygiene**
7. **Add missing tokens** (F7): shadow, breakpoint, focus-ring (width/offset), border-width, motion, z-index.
8. **De-collide the Mobile type scale** (F8); consider `clamp()`.
9. **Naming cleanup** (F9): `Semantic`, delete `gap/4xs 2`, radius → `--radius-*`, opacity → `0–1`.

---

## Appendix A — Resolved token values

### Semantic — `Sematic` (working dark via primitive inversion)
| Role | → alias | Light | Dark |
|---|---|---|---|
| primary | Palette/primary | `#737373` | `#737373` |
| primary-foreground | | `#ffffff` | `#000000` |
| background | Base/White | `#ffffff` | `#000000` |
| foreground | Slate/900 | `#0f172a` | `#f1f5f9` |
| muted | Slate/100 | `#f1f5f9` | `#0f172a` |
| muted-foreground | Slate/500 | `#64748b` | `#64748b` |
| border / input | Slate/200 | `#e2e8f0` | `#1e293b` |
| destructive | Red/500 | `#ef4444` | `#ef4444` |
| info | Cyan/500 | `#06b6d4` | `#06b6d4` |
| success | Green/500 | `#22c55e` | `#22c55e` |
| warning | Amber/500 | `#f59e0b` | `#f59e0b` |
| ring / outline | Palette/primary | `#737373` | `#737373` |
| surface / sidebar | Slate/50 | `#f8fafc` | `#020617` |
| chart-1…5 | Orange600 / Teal600 / Cyan900 / Amber400 / Amber500 | — | — |

### Semantic — `Mode` (Dark broken, see F3)
| Role | Light | Dark |
|---|---|---|
| background | `#ffffff` | `#f8fafc` ⚠ |
| foreground | `#020617` | `#020617` ⚠ |
| card | `#ffffff` | `#f1f5f9` ⚠ |
| primary | `#3b82f6` | `#3b82f6` |
| secondary / muted / accent | `#f1f5f9` | `#e2e8f0` |
| border / input | `#e2e8f0` | `#e2e8f0` |
| ring | `#3b82f6` | `#3b82f6` |

### Scales
- **Radius (px):** none 0 · xs 2 · sm 4 · md 6 · lg 8 · xl 12 · 2xl 16 · 3xl 24 · full 9999
- **Spacing padding (px):** 4xs 2 · 3xs 4 · 2xs 6 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · 2xl 40 · 3xl 48
- **Spacing gap (px):** none 0 · 3xs 4 · 2xs 6 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · 2xl 40 · 3xl 48 · 4xl 56 · 5xl 64 · 6xl 96 · 7xl 128 · *(+ stray `4xs 2` = 2)*
- **Opacity:** 0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100
- **Weights:** thin 100 · extralight 200 · light 300 · normal 400 · medium 500 · semibold 600 · bold 700 · extrabold 800 · black 900
- **Type sizes (Desktop / Mobile, px):** xs 12/12 · sm 14/**12** · base 16/14 · lg 18/**14** · xl 20/16 · 2xl 24/20 · 3xl 32/**20** · 4xl 36/24 · 5xl 48/32 · 6xl 60/36 · 7xl 72/48 · 8xl 80/48 *(bold = Mobile collisions, F8)*
- **Custom ramps (invert L↔D, F1):** Taupe, Mauve, Mist, Olive — each 50↔950 swap, 500 stable (e.g. `Taupe/50` `#fbfaf9`↔`#0d0807`).

## Appendix B — Contrast method
WCAG 2.x: relative luminance `L = 0.2126·R + 0.7152·G + 0.0722·B` (linearized sRGB), ratio `(L_light + 0.05) / (L_dark + 0.05)`. Thresholds: 4.5:1 normal text, 3:1 large text / UI. Computed from Figma-resolved hex.

## Sources
Primary sources verified during research (2025–2026):

- **W3C DTCG — Design Tokens Format Module (2025.10)** — [designtokens.org][dtcg]
- **W3C WCAG 2.1** (SC 1.4.3, 1.4.11) — [w3.org][wcag] · **WebAIM contrast** — [webaim.org][webaim]
- **Material Design 3 — colour system** — [m3.material.io][m3]
- **Adobe Spectrum — design tokens** — [spectrum.adobe.com][spectrum]
- **Radix Colors — understanding the scale** — [radix-ui.com][radix-scale] · white-text-on-step-9 discussion — [github #42][radix42]
- **Tailwind CSS v4 — theme variables** — [tailwindcss.com][tw-theme]
- **shadcn/ui — theming** — [ui.shadcn.com][shadcn-theme] · **Tailwind v4** — [ui.shadcn.com][shadcn-v4]
- **Atlassian — spacing** — [atlassian.design][atl-spacing]
- **Tokens Studio — token sets** — [docs.tokens.studio][ts-sets] · **Style Dictionary transform** — [docs.tokens.studio][ts-sd]
- **Nathan Curtis / EightShapes — Naming Tokens in Design Systems** — [medium.com][es-naming]
- **Design Systems Collective — when semantic tokens are no longer semantic** — [designsystemscollective.com][dsc]

[dtcg]: https://www.designtokens.org/tr/2025.10/format/
[wcag]: https://www.w3.org/TR/WCAG21/
[webaim]: https://webaim.org/articles/contrast/
[m3]: https://m3.material.io/styles/color/system/how-the-system-works
[spectrum]: https://spectrum.adobe.com/page/design-tokens/
[radix-scale]: https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
[radix42]: https://github.com/radix-ui/colors/issues/42
[tw-theme]: https://tailwindcss.com/docs/theme
[shadcn-theme]: https://ui.shadcn.com/docs/theming
[shadcn-v4]: https://ui.shadcn.com/docs/tailwind-v4
[atl-spacing]: https://atlassian.design/foundations/spacing
[ts-sets]: https://docs.tokens.studio/manage-tokens/token-sets/
[ts-sd]: https://docs.tokens.studio/transform-tokens/style-dictionary
[es-naming]: https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676
[dsc]: https://www.designsystemscollective.com/when-semantic-tokens-are-no-longer-semantic-d65ef16fadd7

---

## Addendum — correction & implementation status

**Correction to F7 (coverage):** this review was built from the Figma **Variables** only. The file *also* has laid-out documentation pages for **Grids, Aspect Ratio, and Icons** that the initial pass missed. Those are legitimate foundation categories; they (plus the shadow effect styles) narrow the real gap. All are now tokenized — see `foundations-blueprint.md` §13.

**What was implemented** (on the duplicated file, not the team original): F1–F4, F6, F8, F9 fixed; new collections added (Border Width, Z-Index, Breakpoints, Motion, Grid, Aspect Ratio, Icon); developer-facing token documentation pages built (bound to local variables); and the F5 export pipeline (DTCG → `tokens.generated.css` → Tailwind). See the blueprint §14 for the status matrix.

---
*Prepared by Claude Code. Token values pulled live from Figma Variables via the Figma MCP; contrast measured from resolved hex; best-practice claims adversarially verified against the primary sources above.*
