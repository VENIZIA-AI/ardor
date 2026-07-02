/**
 * figma-export.js — REFERENCE script for re-exporting Figma Variables into tokens/*.json.
 *
 * This is NOT run with node/bun. It is meant to be executed by an AI agent (Claude Code)
 * through the Figma Dev Mode MCP `use_figma` tool — the body below runs inside Figma's
 * Plugin API context (has `figma`, top-level await). It returns an object of file contents;
 * the agent then writes each string to packages/ui-kit/tokens/<name>.
 *
 * Usage: tell Claude "re-export the Figma variables into tokens/ and rebuild", pointing at
 * the file. See tokens/HOW-TO-UPDATE.md. After writing files: `bun run tokens:build`.
 */

const toHex = (c) => {
  const f = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + f(c.r) + f(c.g) + f(c.b);
};
const colls = await figma.variables.getLocalVariableCollectionsAsync();
const allVars = await figma.variables.getLocalVariablesAsync();
const byId = {}, collById = {};
for (const v of allVars) byId[v.id] = v;
for (const c of colls) collById[c.id] = c;
const find = (n) => colls.find((c) => c.name === n);
const prim = find('Primitives'), palC = find('Palette');
const palBlue = palC.modes.find((m) => m.name === 'Blue').modeId;
const colorRef = (name) => '{color.' + name.split('/').map((s) => s.toLowerCase()).join('.') + '}';

// Follow aliases to the final primitive NAME. For the Palette layer, resolve via `palMode`
// (defaults to Blue) so semantic tokens export the primitive of the default accent theme.
function resolvePrim(startId, semMode, palMode) {
  let v = byId[startId];
  for (let g = 0; g < 12 && v; g++) {
    const coll = collById[v.variableCollectionId];
    let mid = coll === palC ? (palMode || palBlue)
      : coll.modes.some((m) => m.modeId === semMode) ? semMode
      : coll.defaultModeId;
    let val = v.valuesByMode[mid] ?? v.valuesByMode[coll.defaultModeId];
    if (val && val.type === 'VARIABLE_ALIAS') { v = byId[val.id]; continue; }
    if (val && val.r !== undefined) return v.name;
    return null;
  }
  return null;
}
const varsOf = (c) => allVars.filter((v) => v.variableCollectionId === c.id);

// ---- primitives.json ----
const colorTree = { $type: 'color' };
for (const v of varsOf(prim)) {
  const val = v.valuesByMode[prim.modes[0].modeId];
  if (!val || val.r === undefined) continue;
  const parts = v.name.split('/').map((s) => s.toLowerCase());
  let node = colorTree;
  for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] ||= {};
  node[parts[parts.length - 1]] = { $value: toHex(val) };
}

// ---- semantic.light/dark.json ----
const sem = find('Semantic');
const L = sem.modes.find((m) => m.name === 'Light').modeId;
const D = sem.modes.find((m) => m.name === 'Dark').modeId;
const semTree = (mode) => {
  const o = { $type: 'color' };
  for (const v of varsOf(sem)) { const p = resolvePrim(v.id, mode); if (p) o[v.name] = { $value: colorRef(p) }; }
  return o;
};

// ---- palette.json (primary + hover/active per theme) ----
// hover/active are the NEXT DARKER steps of each theme's own primary (700-based
// themes get 800/900). If primary is already near-black (900/950), darker steps
// would collapse into the same colour, so we step LIGHTER instead (950 -> 900/800).
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
function stepShift(ref, n) {
  const m = typeof ref === 'string' && ref.match(/^\{color\.([a-z0-9-]+)\.(\d+)\}$/);
  if (!m) return ref;
  const i = STEPS.indexOf(m[2]);
  if (i < 0) return ref;
  const j = i + 2 <= STEPS.length - 1 ? i + n : i - n;
  return '{color.' + m[1] + '.' + STEPS[Math.max(0, Math.min(j, STEPS.length - 1))] + '}';
}
const pv = {}; for (const v of varsOf(palC)) pv[v.name] = v;
const palette = { palette: {} };
for (const m of palC.modes) {
  const p = pv['primary'] ? resolvePrim(pv['primary'].id, null, m.modeId) : null;
  const primaryRef = p ? colorRef(p) : null;
  palette.palette[m.name.toLowerCase()] = { primary: primaryRef, primaryHover: stepShift(primaryRef, 1), primaryActive: stepShift(primaryRef, 2) };
}

// ---- scales.json (numeric/string collections) ----
const round = (v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v); // strip float noise (0.05000000074 -> 0.05)
const flatNums = (name, unit) => {
  const c = find(name); if (!c) return {};
  const m = c.modes[0].modeId; const o = {};
  for (const v of varsOf(c)) { const val = round(v.valuesByMode[m]); const key = v.name.split('/').pop(); o[key] = { $value: unit ? val + unit : val }; }
  return o;
};
const typo = find('Typography'); const td = typo.modes.find((m) => m.name === 'Desktop').modeId;
const text = {}, weight = {};
for (const v of varsOf(typo)) { const val = round(v.valuesByMode[td]); if (v.name.startsWith('text/')) text[v.name.split('/')[1]] = { $value: val + 'px' }; else if (v.name.startsWith('font-weight/')) weight[v.name.split('/')[1]] = { $value: val }; }
const scales = {
  radius: flatNums('Radius', 'px'), space: flatNums('Spacing', 'px'), border: flatNums('Border Width', 'px'),
  breakpoint: flatNums('Breakpoints', 'px'), text, 'font-weight': weight, opacity: flatNums('Opacity', ''),
  z: flatNums('Z-Index', ''),
};
// motion: duration needs ms, ease is string
const mo = find('Motion'); const mm = mo.modes[0].modeId; const duration = {}, ease = {};
for (const v of varsOf(mo)) { const val = v.valuesByMode[mm]; if (v.name.startsWith('duration/')) duration[v.name.split('/')[1]] = { $value: val + 'ms' }; else if (v.name.startsWith('ease/')) ease[v.name.split('/')[1]] = { $value: val }; }
scales.duration = duration; scales.ease = ease;
scales.aspect = flatNums('Aspect Ratio', ''); scales['icon-size'] = {}; scales['icon-stroke'] = {};
const icC = find('Icon'); if (icC) { const im = icC.modes[0].modeId; for (const v of varsOf(icC)) { const val = v.valuesByMode[im]; if (v.name.startsWith('icon-size/')) scales['icon-size'][v.name.split('/')[1]] = { $value: val + 'px' }; else scales['icon-stroke'][v.name.split('/')[1]] = { $value: val + 'px' }; } }
// grid: columns stay unitless; margin/gutter are px dimensions
const gr = find('Grid'); scales.grid = {}; if (gr) for (const v of varsOf(gr)) { const key = v.name.split('/')[1]; for (const m of gr.modes) { const val = round(v.valuesByMode[m.modeId]); scales.grid[m.name.toLowerCase() + '-' + key] = { $value: key === 'columns' ? val : val + 'px' }; } }

// ---- component.json (component -> semantic role refs) ----
const comp = find('Component'); const compTree = { $type: 'color' };
if (comp) for (const v of varsOf(comp)) {
  const val = v.valuesByMode[comp.modes[0].modeId];
  if (val && val.type === 'VARIABLE_ALIAS') { const t = byId[val.id]; const parts = v.name.split('/'); let n = compTree; for (let i = 0; i < parts.length - 1; i++) n = n[parts[i]] ||= {}; n[parts[parts.length - 1]] = { $value: '{' + t.name + '}' }; }
}

return {
  files: {
    'primitives.json': JSON.stringify({ color: colorTree }, null, 2),
    'semantic.light.json': JSON.stringify(semTree(L), null, 2),
    'semantic.dark.json': JSON.stringify(semTree(D), null, 2),
    'palette.json': JSON.stringify(palette, null, 2),
    'scales.json': JSON.stringify(scales, null, 2),
    'component.json': JSON.stringify(compTree, null, 2),
  },
};
