# Ardor UI Kit — Target Foundation Blueprint

> **Purpose.** The agreed end-state design for the Figma **Foundations** (design tokens), rebuilt to best practice while **reusing the good content that already exists**. This is the blueprint to review **once**; implementation happens on the duplicated file (`QpLgleBypJZgSPU1zV5r50`) step-by-step against it.
>
> Companion docs: `foundations-review.md` (the problems this fixes). Target consumers: **headless Base UI + Tailwind CSS v4 + shadcn** conventions.
>
> **Status:** DRAFT for approval. Values marked ⚠️ are decisions to confirm (see §11).

---

## 1. Principles (the rules every token obeys)

1. **Three layers, one direction:** `Primitive (immutable) → Semantic (themed) → Component`. A component never reads a primitive directly.
2. **Primitives are context-free and immutable.** `White` is always `#ffffff`. No mode switching in the primitive layer. *(Fixes F1.)*
3. **Theming lives in the Semantic layer.** Light/Dark is expressed by aliasing each role to a *different* primitive per mode. *(Fixes F1/F3.)*
4. **One source of truth per concept.** Exactly one Semantic collection; one spacing scale. No duplicates. *(Fixes F2/F6.)*
5. **Accessibility is built into the tokens.** Every text-bearing semantic pair meets **WCAG AA (≥4.5:1)** by construction. *(Fixes F4.)*
6. **Names map cleanly to Tailwind v4 & DTCG.** No `.` (Figma forbids it in variable names), no misspellings, Tailwind-namespace-aligned. *(Fixes F9.)*
7. **Everything is exportable.** The structure round-trips through DTCG → Style Dictionary → Tailwind `@theme`. *(Enables F5.)*

---

## 2. Target collections (end state)

| # | Collection | Layer | Modes | Purpose |
|---|---|---|---|---|
| 1 | **Primitives** | Primitive | **1 (`Value`)** | Raw, immutable colours (Tailwind ramps + custom + Base) |
| 2 | **Spacing** | Primitive | 1 (`Value`) | One `space/*` scale (padding **and** gap) |
| 3 | **Radius** | Primitive | 1 (`Value`) | `radius/*` (renamed from `rounded/*`) |
| 4 | **Typography** | Primitive | Desktop / Mobile | weights + sizes (collisions removed) |
| 5 | **Typeface** | Primitive | 1 | font families |
| 6 | **Opacity** | Primitive | 1 | `op/*` stored `0–1` |
| 7 | **Elevation** *(new)* | Primitive | 1 | shadow tokens (see §7) |
| 8 | **Border Width** *(new)* | Primitive | 1 | `border/*` stroke widths |
| 9 | **Motion** *(new)* | Primitive | 1 | duration (ms) + easing (string) |
| 10 | **Z-Index** *(new)* | Primitive | 1 | stacking ladder |
| 11 | **Breakpoints** *(new)* | Primitive | 1 | responsive widths (code-facing) |
| 12 | **Semantic** | Semantic | **Light / Dark** | the **single** role layer components consume |
| 13 | **Palette** | Semantic | 10 accent themes | themeable accent (`primary-*`) |

Net change vs today: Primitives loses its Light/Dark modes; `Sematic` is deleted and its extras folded into one **Semantic** (Light/Dark); `Spacing` collapses to one scale; `rounded/*`→`Radius`; **5 new** primitive collections added.

---

## 3. Colour — Primitives (immutable)

**Rule:** one `Value` mode. Every ramp holds its true Tailwind value, unchanging. `Base/White = #ffffff`, `Base/Black = #000000` — always.

- **Keep** all existing ramps: Slate, Gray, Zinc, Neutral, Stone, Red, Orange, Amber, Yellow, Lime, Green, Emerald, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose (50–950).
- **Keep** the custom ramps **Taupe, Mauve, Mist, Olive** — but **de-invert** them (currently they flip L↔D). Pick each step's *light-mode* value as the single true value (e.g. `Taupe/50 = #fbfaf9`, `Taupe/950 = #0d0807`).
- **Scope:** all colours scoped to fills/strokes only (not text-content).

> **This single change fixes F1.** Because primitives stop moving, `Slate/900` finally means one fixed colour, and export tools get a stable `$value`.

---

## 4. Colour — Semantic (the single role layer)

**One** collection, **Light / Dark** modes. Every role **aliases a primitive**, chosen per mode. Components only ever use these.

### 4.1 Core roles — proposed values (all pairs meet WCAG AA)

| Role | Light → primitive | Dark → primitive | Notes |
|---|---|---|---|
| `background` | Base/White | Slate/950 | page bg |
| `foreground` | Slate/950 | Slate/50 | body text (19:1 / 17:1) |
| `card` / `popover` | Base/White | Slate/900 | raised surfaces |
| `card-foreground` / `popover-foreground` | Slate/950 | Slate/50 | |
| `primary` | **Blue/600** `#2563eb` | Blue/600 | white text = **5.17:1** ✅ (was 500 = 3.68 ✗) |
| `primary-foreground` | Base/White | Base/White | |
| `secondary` | Slate/100 | Slate/800 | |
| `secondary-foreground` | Slate/900 | Slate/50 | |
| `muted` | Slate/100 | Slate/800 | |
| `muted-foreground` | **Slate/600** `#475569` | Slate/400 | ~7:1 (was 500 = 4.76, borderline) |
| `accent` | Slate/100 | Slate/800 | |
| `accent-foreground` | Slate/900 | Slate/50 | |
| `border` | Slate/200 | Slate/800 | |
| `input` | Slate/200 | Slate/800 | |
| `ring` | Blue/600 | Blue/500 | focus ring colour |
| `outline` | Blue/600 | Blue/500 | |
| `surface` | Slate/50 | Slate/900 | |

### 4.2 Status roles — accessible by construction

Two consistent rules (pick one in §11 · **Option A recommended**):

**Option A — dark, saturated fill + white text (600/700):**

| Role | Fill (L/D) | Foreground | White-text contrast |
|---|---|---|---|
| `destructive` | Red/600 `#dc2626` | White | **4.83:1** ✅ |
| `success` | Green/700 `#15803d` | White | **5.02:1** ✅ |
| `warning` | Amber/700 `#b45309` | White | **5.02:1** ✅ |
| `info` | Cyan/700 `#0e7490` | White | **5.36:1** ✅ |

**Option B — bright fill + dark text (keeps vivid 500 hues):**

| Role | Fill | Foreground | Contrast |
|---|---|---|---|
| `destructive` | Red/600 | White | 4.83 (red stays dark either way) |
| `success` | Green/500 `#22c55e` | Slate/950 | ~10:1 ✅ |
| `warning` | Amber/500 `#f59e0b` | Slate/950 | ~10:1 ✅ |
| `info` | Cyan/500 `#06b6d4` | Slate/950 | ~8:1 ✅ |

Each status role also gets a matching `*-foreground`. (Radix's own guidance: bright hues like amber/cyan should carry **dark** text, which is exactly Option B.)

### 4.3 Sidebar + chart roles
Keep the `sidebar-*` and `chart-1..5` roles, migrated into this one collection with Light/Dark aliases (chart hues from Blue/Teal/Orange/Purple/Pink 500–600).

> **Fixes F2 (one collection), F3 (real Dark), F4 (accessible values).**

---

## 5. Colour — Palette (accent themes)

Keep the 10-mode accent Palette (Neutral, Red, Orange, Yellow, Green, Teal, Cyan, Blue, Purple, Pink) — it's a genuine "context" axis and a legitimate use of modes.

- **Fix:** bind `primary` in each theme to the **600** step (not 500) so `primary` + white text passes AA in every theme. Keep `primary-50…950` and `primary-opacity-*`.
- This is the Figma source for the code's `.theme-*` classes; align the two sets (code currently has amber/rose/violet; Palette has Cyan/Neutral — reconcile in §11).

---

## 6. Spacing (one scale)

**One `space/*` scale**, `Value` mode, used for **both** padding and gap. Value = multiplier × 4px (Tailwind's model, confirmed from `tailwindcss.com/docs/padding`: `p-<n> = calc(var(--spacing) * n)`).

**Naming rule:** Figma forbids `.`, so fractional steps use a dash: `space/0-5` = 0.5. (Maps to Tailwind `p-0.5`.)

| Token | px | Token | px | Token | px |
|---|--|---|--|---|--|
| space/0 | 0 | space/3 | 12 | space/10 | 40 |
| space/px | 1 | space/3-5 | 14 | space/11 | 44 |
| space/0-5 | 2 | space/4 | 16 | space/12 | 48 |
| space/1 | 4 | space/5 | 20 | space/14 | 56 |
| space/1-5 | 6 | space/6 | 24 | space/16 | 64 |
| space/2 | 8 | space/7 | 28 | space/20 | 80 |
| space/2-5 | 10 | space/8 | 32 | space/24 | 96 |
| | | space/9 | 36 | space/28 | 112 |
| | | | | space/32 | 128 |

- **Scope:** `GAP` + `WIDTH_HEIGHT` (Figma "Gap" scope covers auto-layout **gap and padding**).
- **Delete** the old `padding/*` and `gap/*` variables. "Padding" vs "gap" is *usage*, not a token.
- Code needs no per-step tokens — Tailwind auto-generates `p-*`/`gap-*` from the single `--spacing: 4px` already in `default.css`.

> **Fixes F6.** (Your original instinct was right; the fix is one enumerated scale — not modes, since a card uses padding *and* gap simultaneously and a node can hold only one mode.)

---

## 7. New primitive collections (fills F7)

| Collection | Type | Tokens (proposed) |
|---|---|---|
| **Radius** | FLOAT (px), scope `CORNER_RADIUS` | `radius/none 0, xs 2, sm 4, md 6, lg 8, xl 12, 2xl 16, 3xl 24, full 9999` (renamed from `rounded/*`) |
| **Elevation** | **Effect styles** (not variables — Figma can't variable-bind shadows) + string tokens for code | `shadow/xs, sm, md, lg, xl, 2xl` = Tailwind's default shadow values |
| **Border Width** | FLOAT (px), scope `STROKE_FLOAT` | `border/0 0, DEFAULT 1, 2, 4, 8` |
| **Motion** | FLOAT (ms) + STRING | `duration/75…700`; `ease/linear, in, out, in-out` (cubic-bezier strings) |
| **Z-Index** | FLOAT | `z/base 0, dropdown 1000, sticky 1100, overlay 1300, modal 1400, popover 1500, toast 1700, tooltip 1800` |
| **Breakpoints** | FLOAT (px) | `sm 640, md 768, lg 1024, xl 1280, 2xl 1536` (code-facing; mirrors Tailwind) |
| **Focus ring** | (semantic) | `ring` colour (§4) + `ring-width 2`, `ring-offset 2` (in Border Width / Spacing) |

> Elevation is the one category Figma can't hold as plain variables — it lives as **effect styles** in Figma and as `--shadow-*` in Tailwind. Documented, not variable-bound.

---

## 8. Typography (collision-free)

- **Typeface:** `heading/family = Inter`; add `body/family` and `mono/family` ⚠️.
- **Weights:** keep `font-weight/thin…black` (100–900).
- **Sizes:** keep `text/xs…8xl` (Desktop/Mobile modes) but **remove the Mobile collisions** (F8). Proposed Mobile values so each named step stays distinct:

| Step | Desktop | Mobile (today → **proposed**) |
|---|--|--|
| xs | 12 | 12 |
| sm | 14 | 12 → **13** |
| base | 16 | 14 |
| lg | 18 | 14 → **16** |
| xl | 20 | 16 → **18** |
| 2xl | 24 | 20 |
| 3xl | 32 | 20 → **26** |
| 4xl+ | 36… | scale down proportionally, no two equal |

- Consider fluid `clamp()` in code for the body range instead of hard mode steps ⚠️.
- Add line-height + letter-spacing tokens ⚠️ (a complete type system pairs size with line-height).

---

## 9. Opacity

Keep `op/*` but store as **`0–1`** (`op/0 = 0`, `op/50 = 0.5`, `op/100 = 1`) so values drop straight into CSS `opacity` / Tailwind. *(Fixes the F9 opacity note.)*

---

## 10. Naming & code mapping

| Figma token | Tailwind v4 | CSS var |
|---|---|---|
| `Semantic/primary` | `bg-primary` `text-primary` | `--color-primary` → `--primary` |
| `Semantic/primary-foreground` | `text-primary-foreground` | `--primary-foreground` |
| `space/6` (24px) | `p-6` `gap-6` | `calc(var(--spacing)*6)` |
| `radius/md` (6px) | `rounded-md` | `--radius-md` |
| `shadow/lg` | `shadow-lg` | `--shadow-lg` |
| `Breakpoints/md` | `md:` | `--breakpoint-md` |

**Rules:** no `.` in names; kebab or slash groups; role names identical to shadcn (`background`, `primary`, `muted-foreground`, …) so `@theme inline` maps 1:1.

**Export path:** Figma Variables → DTCG JSON (Tokens Studio) → `@tokens-studio/sd-transforms` → Style Dictionary → CSS custom properties → Tailwind `@theme inline` (shadcn pattern). This is how the blueprint reaches `default.css` and closes F5.

---

## 11. Decisions to confirm (⚠️)

1. **Status colour rule:** Option A (600/700 + white text) or Option B (500 + dark text, more vivid)? *(Recommend A for button-heavy UIs.)*
2. **Primary already chosen:** Blue (`Blue/600` for AA). ✅ confirmed.
3. **Accent theme set:** reconcile Figma Palette (has Cyan, Neutral) with code `.theme-*` (has amber, rose, violet) — keep which 10?
4. **Typography:** add body/mono families? line-height + letter-spacing tokens? fluid `clamp()` vs Mobile mode steps?
5. **Scope of build now:** do all 13 collections, or start with the P0 set (Primitives de-invert → Semantic → Spacing → Radius) and add the 5 new collections after?

---

## 12. Build order (once approved)

1. **Primitives:** remove Light/Dark → single `Value` mode; de-invert custom ramps. *(Additive-safe: set all to light values, then delete the Dark mode.)*
2. **Semantic:** in the `Semantic` collection, wire Light/Dark aliases per §4; add `info/success/warning/outline/surface`; set accessible status values.
3. **Spacing:** add `space/*` (done partially) → delete old `padding/*`,`gap/*`.
4. **Radius:** rename `rounded/*` → `Radius/radius/*`.
5. **Opacity:** convert to `0–1`.
6. **Typography:** de-collide Mobile sizes.
7. **New collections:** Elevation (effect styles), Border Width, Motion, Z-Index, Breakpoints.
8. **Palette:** bind `primary` to 600 per theme.
9. **Validate** (screenshots + a sample component in Light/Dark), then wire the export pipeline (separate task).

Each step is validated before the next; nothing destructive runs without confirmation.

---

## 13. Added foundation categories (from the Figma docs pages)

The Figma file has laid-out documentation pages for **Grids, Aspect Ratio, and Icons** that were not in the Variables. These are now first-class token collections:

| Collection | Modes | Tokens |
|---|---|---|
| **Grid** | Desktop / Tablet / Mobile | `grid/columns` (12 / 10 / 4), `grid/margin` (80 / 48 / 20), `grid/gutter` (20 / 20 / 20) |
| **Aspect Ratio** | 1 | `aspect/square 1:1`, `4-3`, `5-3`, `16-9`, `2-1`, `3-4`, `3-5`, `9-16`, `1-2` → Tailwind `aspect-*` |
| **Icon** | 1 | `icon-size/xs…xl` (16/20/24/32/40), `icon-stroke/default` (1.5). The glyph set (outline, `arrow-*`…) stays a component/asset library, not variables. |

## 14. Implementation status (on the duplicated file `QpLgleBypJZgSPU1zV5r50`)

| Area | Status |
|---|---|
| F1 Primitives immutable (removed Light/Dark, de-inverted) | ✅ done |
| F2 Single `Semantic` collection (deleted `Mode`; `Sematic`→`Semantic`) | ✅ done |
| F3 Real Light/Dark in Semantic | ✅ done |
| F4 Accessible values (primary Blue/600, status 600/700, palette AA-min per theme) | ✅ done |
| F6 One `space/*` scale (removed padding/gap) | ✅ done |
| F9 `Radius` rename, `Opacity` 0–1, `gap/4xs 2` gone | ✅ done |
| F7 New collections: Border Width, Z-Index, Breakpoints, Motion, Grid, Aspect Ratio, Icon | ✅ done |
| F8 Mobile type scale de-collided | ✅ done |
| Elevation | already existed (bespoke Bottom/Top/Action effect styles) — kept |
| Developer docs pages (Colors/Spacing/Radius/Border/Typography/Shadow/Layout/Motion/Icon), bound to local vars | ✅ built |
| F5 Export pipeline (DTCG → `tokens.generated.css` → Tailwind) | ✅ built (`bun run tokens:build`) |

**§11 decisions resolved:** status = Option A (600/700 + white text); primary = Blue; build scope = full.

## 15. Token tiers (M3/Polaris depth)

The system now has four tiers:

1. **Primitive** — immutable raw values (`color.blue.600`, `space/6`, `radius/md`).
2. **Semantic** — roles that switch by mode + accent palette (`primary`, `background`, `success`, …), **incl. interaction states**: `*-hover`, `*-active`, `disabled`, `disabled-foreground`, `input-hover`.
3. **Palette** — 10 accent themes; `primary` follows the active palette (Figma mode / code `.theme-*`), with `primaryHover`/`primaryActive` steps.
4. **Component** — component-scoped tokens aliasing semantic/state: `button/{primary,secondary,outline,ghost,destructive,disabled}/*`, `input/*`, `card/*`, `badge/*`, `alert/*`. In code these compile to `--button-primary-bg` etc. in `:root` (inheriting light/dark via the semantic vars they reference).

Consumption order: components read **component** tokens (or the semantic ones directly via Tailwind utilities such as `bg-primary`, `hover:bg-primary-hover`, `disabled:bg-disabled`). Never read primitives directly.

---
*Prepared by Claude Code. Values grounded in the Figma tokens + measured WCAG contrast. Implemented on the duplicated file, not the team's original.*
