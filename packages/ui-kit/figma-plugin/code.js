// Ardor — Export Design Tokens (Figma plugin, main thread / Plugin API)
// Reads every local Variable collection and produces the DTCG token files that
// packages/ui-kit/tokens/ expects. Sends them to the UI, which downloads them.
// No agent, no Enterprise API required.

figma.showUI(__html__, { width: 400, height: 560, title: 'Export Design Tokens' });

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

(async () => {
  try {
    const toHex = (c) => {
      const f = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
      return '#' + f(c.r) + f(c.g) + f(c.b);
    };
    // strip float noise: 0.05000000074 -> 0.05
    const round = (v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v);

    const colls = await figma.variables.getLocalVariableCollectionsAsync();
    const allVars = await figma.variables.getLocalVariablesAsync();
    const byId = {}, collById = {};
    for (const v of allVars) byId[v.id] = v;
    for (const c of colls) collById[c.id] = c;
    const find = (n) => colls.find((c) => c.name === n);

    // Friendly validation: collections are looked up BY NAME.
    const required = ['Primitives', 'Semantic', 'Palette', 'Spacing', 'Radius', 'Typography'];
    const missing = required.filter((n) => !find(n));
    if (missing.length) {
      throw new Error(
        'Missing variable collection(s): ' + missing.join(', ') +
        '. Collection names must match exactly (see figma-plugin/README.md).'
      );
    }

    const prim = find('Primitives'), palC = find('Palette');
    const palBlue = (palC.modes.find((m) => m.name === 'Blue') || palC.modes[0]).modeId;
    const colorRef = (name) => '{color.' + name.split('/').map((s) => s.toLowerCase()).join('.') + '}';

    // Follow aliases to the final primitive NAME. Palette layer resolves via `palMode`
    // (defaults to Blue) so semantic tokens export the default accent theme.
    function resolvePrim(startId, semMode, palMode) {
      let v = byId[startId];
      for (let g = 0; g < 12 && v; g++) {
        const coll = collById[v.variableCollectionId];
        const mid = coll === palC ? (palMode || palBlue)
          : coll.modes.some((m) => m.modeId === semMode) ? semMode
          : coll.defaultModeId;
        const val = v.valuesByMode[mid] != null ? v.valuesByMode[mid] : v.valuesByMode[coll.defaultModeId];
        if (val && val.type === 'VARIABLE_ALIAS') { v = byId[val.id]; continue; }
        if (val && val.r !== undefined) return v.name;
        return null;
      }
      return null;
    }
    // Interaction step for hover/active: normally n steps DARKER
    // ('{color.orange.700}'+1 -> 800). If primary is already near-black
    // (900/950) darker steps would collapse into the same colour, so we
    // step LIGHTER instead (950 -> hover 900, active 800).
    function stepShift(ref, n) {
      const m = typeof ref === 'string' && ref.match(/^\{color\.([a-z0-9-]+)\.(\d+)\}$/);
      if (!m) return ref;
      const i = STEPS.indexOf(m[2]);
      if (i < 0) return ref;
      const j = i + 2 <= STEPS.length - 1 ? i + n : i - n;
      return '{color.' + m[1] + '.' + STEPS[Math.max(0, Math.min(j, STEPS.length - 1))] + '}';
    }
    const varsOf = (c) => allVars.filter((v) => v.variableCollectionId === c.id);

    // ---- primitives.json (raw hex) ----
    const colorTree = { $type: 'color' };
    for (const v of varsOf(prim)) {
      const val = v.valuesByMode[prim.modes[0].modeId];
      if (!val || val.r === undefined) continue;
      const parts = v.name.split('/').map((s) => s.toLowerCase());
      let node = colorTree;
      for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] || (node[parts[i]] = {});
      node[parts[parts.length - 1]] = { $value: toHex(val) };
    }

    // ---- semantic.light.json / semantic.dark.json (aliases) ----
    const sem = find('Semantic');
    const L = (sem.modes.find((m) => m.name === 'Light') || sem.modes[0]).modeId;
    const D = (sem.modes.find((m) => m.name === 'Dark') || sem.modes[0]).modeId;
    const semTree = (mode) => {
      const o = { $type: 'color' };
      for (const v of varsOf(sem)) { const p = resolvePrim(v.id, mode); if (p) o[v.name] = { $value: colorRef(p) }; }
      return o;
    };

    // ---- palette.json: hover/active = next darker steps of each theme's own primary ----
    const pv = {}; for (const v of varsOf(palC)) pv[v.name] = v;
    const palette = { palette: {} };
    for (const m of palC.modes) {
      const p = pv['primary'] ? resolvePrim(pv['primary'].id, null, m.modeId) : null;
      const primaryRef = p ? colorRef(p) : null;
      palette.palette[m.name.toLowerCase()] = {
        primary: primaryRef,
        primaryHover: stepShift(primaryRef, 1),
        primaryActive: stepShift(primaryRef, 2),
      };
    }

    // ---- scales.json (numeric/string collections) ----
    const flat = (name, unit) => {
      const c = find(name); if (!c) return {};
      const m = c.modes[0].modeId; const o = {};
      for (const v of varsOf(c)) {
        const val = round(v.valuesByMode[m]);
        o[v.name.split('/').pop()] = { $value: unit ? val + unit : val };
      }
      return o;
    };
    const typo = find('Typography');
    const td = (typo.modes.find((m) => m.name === 'Desktop') || typo.modes[0]).modeId;
    const text = {}, weight = {};
    for (const v of varsOf(typo)) {
      const val = round(v.valuesByMode[td]);
      if (v.name.indexOf('text/') === 0) text[v.name.split('/')[1]] = { $value: val + 'px' };
      else if (v.name.indexOf('font-weight/') === 0) weight[v.name.split('/')[1]] = { $value: val };
    }
    const scales = {
      radius: flat('Radius', 'px'), space: flat('Spacing', 'px'), border: flat('Border Width', 'px'),
      breakpoint: flat('Breakpoints', 'px'), text, 'font-weight': weight,
      opacity: flat('Opacity', ''), z: flat('Z-Index', ''),
    };
    const mo = find('Motion'); const duration = {}, ease = {};
    if (mo) {
      const mm = mo.modes[0].modeId;
      for (const v of varsOf(mo)) {
        const val = round(v.valuesByMode[mm]);
        if (v.name.indexOf('duration/') === 0) duration[v.name.split('/')[1]] = { $value: val + 'ms' };
        else if (v.name.indexOf('ease/') === 0) ease[v.name.split('/')[1]] = { $value: val };
      }
    }
    scales.duration = duration; scales.ease = ease;
    scales.aspect = flat('Aspect Ratio', '');
    scales['icon-size'] = {}; scales['icon-stroke'] = {};
    const icC = find('Icon');
    if (icC) {
      const im = icC.modes[0].modeId;
      for (const v of varsOf(icC)) {
        const val = round(v.valuesByMode[im]);
        if (v.name.indexOf('icon-size/') === 0) scales['icon-size'][v.name.split('/')[1]] = { $value: val + 'px' };
        else scales['icon-stroke'][v.name.split('/')[1]] = { $value: val + 'px' };
      }
    }
    // grid: columns stay unitless; margin/gutter are px dimensions
    const gr = find('Grid'); scales.grid = {};
    if (gr) for (const v of varsOf(gr)) {
      const key = v.name.split('/')[1];
      for (const m of gr.modes) {
        const val = round(v.valuesByMode[m.modeId]);
        scales.grid[m.name.toLowerCase() + '-' + key] = { $value: key === 'columns' ? val : val + 'px' };
      }
    }

    // ---- component.json (component -> semantic role refs) ----
    const comp = find('Component'); const compTree = { $type: 'color' };
    if (comp) for (const v of varsOf(comp)) {
      const val = v.valuesByMode[comp.modes[0].modeId];
      if (val && val.type === 'VARIABLE_ALIAS') {
        const t = byId[val.id];
        const parts = v.name.split('/');
        let n = compTree;
        for (let i = 0; i < parts.length - 1; i++) n = n[parts[i]] || (n[parts[i]] = {});
        n[parts[parts.length - 1]] = { $value: '{' + t.name + '}' };
      }
    }

    const files = {
      'primitives.json': JSON.stringify({ color: colorTree }, null, 2) + '\n',
      'semantic.light.json': JSON.stringify(semTree(L), null, 2) + '\n',
      'semantic.dark.json': JSON.stringify(semTree(D), null, 2) + '\n',
      'palette.json': JSON.stringify(palette, null, 2) + '\n',
      'scales.json': JSON.stringify(scales, null, 2) + '\n',
      'component.json': JSON.stringify(compTree, null, 2) + '\n',
    };
    figma.ui.postMessage({
      type: 'files', files,
      counts: { primitives: varsOf(prim).length, semantic: varsOf(sem).length, palette: palC.modes.length, component: comp ? varsOf(comp).length : 0 },
    });
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
  }
})();

figma.ui.onmessage = (msg) => { if (msg && msg.type === 'close') figma.closePlugin(); };
