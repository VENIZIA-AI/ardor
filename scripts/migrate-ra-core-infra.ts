#!/usr/bin/env bun
/**
 * Migrates a consumer repository from `@minimaltech/ra-core-infra` to ARDOR.
 *
 * Run it from the consumer repository root (it never writes inside ARDOR itself):
 *
 *   bun /path/to/ardor/scripts/migrate-ra-core-infra.ts            # dry run, prints the plan
 *   bun /path/to/ardor/scripts/migrate-ra-core-infra.ts --apply    # writes the changes
 *
 * Options:
 *   --root <dir>   repository to migrate (default: the current working directory)
 *   --apply        write the changes; without it nothing is modified
 *
 * Four transforms:
 *   1. import/export specifier  `@minimaltech/ra-core-infra` -> `@venizia/ardor`
 *   2. the react-admin names dropped by the rebrand (`*RaApplication` -> ARDOR names)
 *   3. `declare module` augmentation blocks retargeted to the packages that DECLARE the override
 *      interfaces - an interface merges only into its declaring module, never through a re-export
 *   4. the dependency entry in every package.json
 */

const UMBRELLA = '@venizia/ardor';
const LEGACY = '@minimaltech/ra-core-infra';

const RENAMES: Array<[RegExp, string]> = [
  [/\bAbstractRaApplication\b/g, 'AbstractArdorApplication'],
  [/\bBaseRaApplication\b/g, 'BaseArdorApplication'],
  [/\bICoreRaApplication\b/g, 'IArdorApplication'],
  [/\bCoreRaApplication\b/g, 'ArdorApplication'],
];

// Which package declares each override interface, and therefore which module an app augments.
const AUGMENTATION_OWNERS: Record<string, string> = {
  IUseInjectableKeysOverrides: '@venizia/ardor-react',
  IUseTranslateKeysOverrides: '@venizia/ardor-admin',
};

const SOURCE_EXTENSIONS: Record<string, true> = {
  '.ts': true,
  '.tsx': true,
  '.js': true,
  '.jsx': true,
  '.mts': true,
  '.cts': true,
};

const SKIP_DIRECTORIES: Record<string, true> = {
  node_modules: true,
  dist: true,
  build: true,
  coverage: true,
  '.git': true,
  '.next': true,
  '.turbo': true,
};

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const rootIndex = argv.indexOf('--root');
const root = rootIndex === -1 ? process.cwd() : argv[rootIndex + 1];

if (!root) {
  console.error('ERROR | --root was passed without a directory');
  process.exit(1);
}

/** Collects every candidate file, skipping build output and vendored trees. */
const collect = async (directory: string, out: { sources: string[]; manifests: string[] }) => {
  const entries = await Array.fromAsync(
    new Bun.Glob('*').scan({ cwd: directory, onlyFiles: false, dot: false }),
  );

  for (const entry of entries) {
    const full = `${directory}/${entry}`;
    const stats = await Bun.file(full).stat();

    if (stats.isDirectory()) {
      if (SKIP_DIRECTORIES[entry]) {
        continue;
      }
      await collect(full, out);
      continue;
    }

    if (entry === 'package.json') {
      out.manifests.push(full);
      continue;
    }

    const dot = entry.lastIndexOf('.');
    if (dot > -1 && SOURCE_EXTENSIONS[entry.slice(dot)]) {
      out.sources.push(full);
    }
  }

  return out;
};

/** Finds the index of the `}` matching the `{` at `open`. */
const matchBrace = (text: string, open: number) => {
  let depth = 0;

  for (let cursor = open; cursor < text.length; cursor += 1) {
    if (text[cursor] === '{') {
      depth += 1;
      continue;
    }
    if (text[cursor] === '}') {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }
  }

  return -1;
};

/**
 * Rewrites `declare module '<legacy>' { ... }` into one block per declaring package. Returns the
 * new text plus the interface names that had no known owner.
 */
const retargetAugmentations = (text: string) => {
  const unknown: string[] = [];
  let output = text;
  let searchFrom = 0;

  for (;;) {
    const header = output.indexOf(`declare module '${LEGACY}'`, searchFrom);
    if (header === -1) {
      break;
    }

    const open = output.indexOf('{', header);
    const close = matchBrace(output, open);
    if (open === -1 || close === -1) {
      break;
    }

    const body = output.slice(open + 1, close);
    const grouped = new Map<string, string[]>();

    for (const match of body.matchAll(/\binterface\s+(\w+)/g)) {
      const name = match[1]!;
      const bodyOpen = body.indexOf('{', match.index!);
      const bodyClose = matchBrace(body, bodyOpen);
      if (bodyOpen === -1 || bodyClose === -1) {
        continue;
      }

      const owner = AUGMENTATION_OWNERS[name];
      if (!owner) {
        unknown.push(name);
      }

      const declaration = body.slice(match.index!, bodyClose + 1).trim();
      const bucket = grouped.get(owner ?? UMBRELLA) ?? [];
      bucket.push(declaration);
      grouped.set(owner ?? UMBRELLA, bucket);
    }

    const rebuilt = [...grouped.entries()]
      .map(([module, declarations]) => {
        const indented = declarations
          .map(declaration => {
            // The captured text starts at the `interface` keyword, so only its first line lost the
            // block indent; every continuation line already carries its original one.
            const [first, ...rest] = declaration.split('\n');
            return [`  ${first!.trim()}`, ...rest].join('\n');
          })
          .join('\n\n');
        return `declare module '${module}' {\n${indented}\n}`;
      })
      .join('\n\n');

    output = output.slice(0, header) + rebuilt + output.slice(close + 1);
    searchFrom = header + rebuilt.length;
  }

  return { output, unknown };
};

const { sources, manifests } = await collect(root, { sources: [], manifests: [] });

const changed = {
  specifier: [] as string[],
  renames: [] as string[],
  augmentation: [] as string[],
  manifest: [] as string[],
};
const unknownAugmentations = new Set<string>();
const diContainerUsages: string[] = [];

for (const file of sources) {
  const original = await Bun.file(file).text();
  if (!original.includes(LEGACY) && !RENAMES.some(([pattern]) => pattern.test(original))) {
    continue;
  }

  let text = original;

  if (text.includes(`declare module '${LEGACY}'`)) {
    const result = retargetAugmentations(text);
    if (result.output !== text) {
      text = result.output;
      changed.augmentation.push(file);
      for (const name of result.unknown) {
        unknownAugmentations.add(name);
      }
    }
  }

  const withSpecifier = text
    .replaceAll(`'${LEGACY}'`, `'${UMBRELLA}'`)
    .replaceAll(`"${LEGACY}"`, `"${UMBRELLA}"`);
  if (withSpecifier !== text) {
    changed.specifier.push(file);
    text = withSpecifier;
  }

  let renamed = text;
  for (const [pattern, replacement] of RENAMES) {
    renamed = renamed.replaceAll(pattern, replacement);
  }
  if (renamed !== text) {
    changed.renames.push(file);
    text = renamed;
  }

  if (/\bDIContainer\b/.test(text)) {
    diContainerUsages.push(file);
  }

  if (text !== original && apply) {
    await Bun.write(file, text);
  }
}

for (const file of manifests) {
  const original = await Bun.file(file).text();
  if (!original.includes(LEGACY)) {
    continue;
  }

  // The umbrella is one dependency, but an augmentation (`declare module '@venizia/ardor-react'`)
  // resolves only when the declaring package is a direct dependency - an isolated install does not
  // hoist it. Every consumer carried augmentations, so all three land together, on one line each.
  const text = original.replace(
    new RegExp(`(\\s*)"${LEGACY.replace('/', '\\/')}":\\s*"[^"]*"`, 'g'),
    (_match, indent: string) =>
      [
        `${indent}"${UMBRELLA}": "^0.1.0",`,
        `${indent}"@venizia/ardor-admin": "^0.1.0",`,
        `${indent}"@venizia/ardor-react": "^0.1.0"`,
      ].join(''),
  );

  changed.manifest.push(file);
  if (apply) {
    await Bun.write(file, text);
  }
}

const relative = (file: string) => file.replace(`${root}/`, '');

console.log(`ARDOR migration | root: ${root} | mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
console.log(`  scanned            ${sources.length} source files, ${manifests.length} manifests`);
console.log(`  import specifier   ${changed.specifier.length} files`);
console.log(`  symbol renames     ${changed.renames.length} files`);
console.log(`  augmentation split ${changed.augmentation.length} files`);
for (const file of changed.augmentation) {
  console.log(`      ${relative(file)}`);
}
console.log(`  package.json       ${changed.manifest.length} files`);
for (const file of changed.manifest) {
  console.log(`      ${relative(file)}`);
}

if (unknownAugmentations.size) {
  console.log(
    `\nWARNING | augmented interfaces with no known owner, left on ${UMBRELLA}: ${[
      ...unknownAugmentations,
    ].join(', ')}`,
  );
}

if (diContainerUsages.length) {
  console.log(
    `\nWARNING | DIContainer was dropped in ARDOR - use the IGNIS inversion Container instead. ${diContainerUsages.length} file(s):`,
  );
  for (const file of diContainerUsages.slice(0, 20)) {
    console.log(`      ${relative(file)}`);
  }
}

console.log(
  [
    '',
    'After applying:',
    '  1. `@venizia/ignis-inversion` must be >=0.2.0-7 (ARDOR needs the metadata registry).',
    '  2. Install, then type-check the consumer to surface anything the codemod could not see.',
    apply ? '' : '  3. Re-run with --apply to write these changes.',
  ]
    .filter(Boolean)
    .join('\n'),
);

export {};
