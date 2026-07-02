/**
 * Build design tokens: DTCG JSON (tokens/*.json, exported from Figma Variables)
 *  ->  src/styles/tokens.generated.css  (CSS custom properties for Tailwind v4).
 *
 * Emits:
 *   :root { primitives + semantic(light) }
 *   .dark { semantic(dark) overrides }
 *   @theme inline { semantic -> Tailwind color-* utilities }
 *   @theme { static scales -> radius/text/font-weight/breakpoint/... }
 *
 * The tokens/*.json files use the W3C DTCG format ($value / $type / {alias} refs),
 * so they can also be fed to Style Dictionary / Tokens Studio if preferred.
 *
 * Run: bun run tokens:build
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const tokdir = join(root, 'tokens');
const read = (f) => JSON.parse(readFileSync(join(tokdir, f), 'utf8'));

const primitives = read('primitives.json');
const semLight = read('semantic.light.json');
const semDark = read('semantic.dark.json');
const scales = read('scales.json');
const palette = read('palette.json');
const component = read('component.json');

/** Flatten a DTCG tree into leaf tokens [{ path, value }]. */
function flatten(obj, prefix = []) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in v) out.push({ path: [...prefix, k], value: v['$value'] });
    else if (v && typeof v === 'object') out.push(...flatten(v, [...prefix, k]));
  }
  return out;
}
const cssVar = (path) => '--' + path.join('-');
/** {color.blue.600} -> var(--color-blue-600) */
const resolveRef = (val) =>
  typeof val === 'string' && val.startsWith('{') && val.endsWith('}')
    ? `var(--${val.slice(1, -1).split('.').join('-')})`
    : val;

const prim = flatten(primitives);
const light = flatten(semLight);
const dark = flatten(semDark);
const scale = flatten(scales);
const comp = flatten(component);

const decl = (name, val) => `  ${name}: ${val};`;
const block = (selector, lines) => `${selector} {\n${lines.join('\n')}\n}`;

const rootLines = [
  '  /* ---- Primitives (immutable) ---- */',
  ...prim.map((t) => decl(cssVar(t.path), t.value)),
  '  /* ---- Semantic (light) ---- */',
  ...light.map((t) => decl(cssVar(t.path), resolveRef(t.value))),
  '  /* ---- Component (alias semantic; inherit dark via referenced vars) ---- */',
  ...comp.map((t) => decl(cssVar(t.path), resolveRef(t.value))),
];
const darkLines = dark.map((t) => decl(cssVar(t.path), resolveRef(t.value)));
const themeInlineLines = light.map((t) => decl('--color-' + t.path.join('-'), `var(--${t.path.join('-')})`));
const themeLines = scale.map((t) => decl(cssVar(t.path), t.value));

// Accent palette themes -> .theme-<name> classes (code equivalent of Figma Palette modes).
const paletteBlocks = Object.entries(palette.palette || {}).map(([name, roles]) => {
  const primary = resolveRef(roles.primary);
  const hover = resolveRef(roles.primaryHover || roles.primary);
  const active = resolveRef(roles.primaryActive || roles.primary);
  const fg = 'var(--color-base-white)';
  return block(`.theme-${name}`, [
    decl('--primary', primary),
    decl('--primary-hover', hover),
    decl('--primary-active', active),
    decl('--primary-foreground', fg),
    decl('--ring', primary),
    decl('--sidebar-primary', primary),
    decl('--sidebar-primary-foreground', fg),
  ]);
});

const out =
  `/* ⚠️  AUTO-GENERATED from tokens/*.json (DTCG) — DO NOT EDIT BY HAND.\n` +
  ` *  Source of truth: Figma Variables -> tokens/*.json.  Regenerate: bun run tokens:build\n */\n\n` +
  [
    block(':root', rootLines),
    block('.dark', darkLines),
    block('@theme inline', themeInlineLines),
    block('@theme', themeLines),
    '/* ---- Accent palette themes (add class to a wrapper, e.g. <html class="theme-pink">) ---- */',
    ...paletteBlocks,
  ].join('\n\n') +
  '\n';

writeFileSync(join(root, 'src/styles/tokens.generated.css'), out);
console.log(
  `tokens.generated.css written — ${prim.length} primitives, ${light.length} semantic (x2 modes), ${scale.length} scale tokens`,
);
