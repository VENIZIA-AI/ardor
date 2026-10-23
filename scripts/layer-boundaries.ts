/**
 * The layering rule of the framework, read from the BUILT output so it measures what a consumer
 * installs: the kernel is isomorphic (no React, no react-admin), the React bindings never reach
 * react-admin, and only `admin` may import `ra-core`. `make purity` answers "is it browser-pure";
 * this answers "is it in the right layer". Exit 1 on the first violation, with file and specifier.
 *
 * Usage: bun scripts/layer-boundaries.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO = resolve(import.meta.dir, '..');

const IMPORT_PATTERN = /^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'|^\s*import\s+'([^']+)'/gm;

/** Specifier prefixes a layer must never import. A bare name also forbids its sub-paths. */
const FORBIDDEN_BY_PACKAGE: Record<string, string[]> = {
  kernel: [
    'react',
    'react-dom',
    'react-redux',
    '@reduxjs/toolkit',
    'ra-core',
    'react-admin',
    'ra-i18n-polyglot',
  ],
  react: ['ra-core', 'react-admin', 'ra-i18n-polyglot'],
};

const listJavaScript = (directory: string): string[] => {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return listJavaScript(path);
    }
    return name.endsWith('.js') ? [path] : [];
  });
};

const isForbidden = (opts: { specifier: string; forbidden: string[] }): boolean => {
  return opts.forbidden.some(
    name => opts.specifier === name || opts.specifier.startsWith(`${name}/`),
  );
};

const violations: string[] = [];

for (const [packageName, forbidden] of Object.entries(FORBIDDEN_BY_PACKAGE)) {
  const dist = resolve(REPO, 'packages', packageName, 'dist');
  for (const file of listJavaScript(dist)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2] ?? '';
      if (isForbidden({ specifier, forbidden })) {
        violations.push(
          `${relative(REPO, file)} imports '${specifier}' - forbidden in ${packageName}`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    `layer-boundaries: ${violations.length} violation(s)\n  ${violations.join('\n  ')}`,
  );
  process.exit(1);
}

console.log(
  `layer-boundaries OK - ${Object.keys(FORBIDDEN_BY_PACKAGE).join(', ')} import nothing from a higher layer`,
);

export {};
