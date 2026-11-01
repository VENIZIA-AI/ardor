/**
 * Every package a generated app imports must be declared in the app's own `package.json`.
 *
 * The preset smoke creates the app in a scratch folder inside this repository, so this repository's
 * `node_modules` is above it and answers a bare import the app never declared: the typecheck, lint,
 * build and dev server pass for the wrong reason, and the published preset would fail on a clean
 * machine. This reads the source instead of resolving it, so where the scratch folder sits cannot
 * hide a missing declaration.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative } from 'node:path';

import ts from 'typescript';

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', '.git']);
const SOURCE_PATTERN = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const DECLARATION_PATTERN = /\.d\.(?:ts|mts|cts)$/;
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
/** Modules the runtime provides: Node's builtins, and `bun` itself (`bun:test` has a protocol). */
const RUNTIME_MODULES = new Set([...builtinModules, 'bun']);

export class DeclaredImports {
  /**
   * The package a bare specifier names (`@scope/name/sub` is `@scope/name`, `name/sub` is `name`);
   * `null` for what no package.json declares: a relative or absolute path, a protocol (`node:`, `bun:`,
   * `virtual:`), a subpath import (`#src/x`) and a runtime module.
   */
  static packageOf(opts: { specifier: string }): string | null {
    const { specifier } = opts;

    if (
      specifier === '' ||
      /^(\.|\/|#)/.test(specifier) ||
      /^[a-z][a-z0-9+.-]*:/i.test(specifier)
    ) {
      return null;
    }

    const [first = '', second = ''] = specifier.split('/');
    const name = first.startsWith('@') ? `${first}/${second}` : first;

    return RUNTIME_MODULES.has(name) ? null : name;
  }

  /** Every source file under `folder`, without node_modules, dist, build and .git. */
  static sources(opts: { folder: string }): string[] {
    return readdirSync(opts.folder, { withFileTypes: true }).flatMap((entry) => {
      const path = join(opts.folder, entry.name);

      if (entry.isDirectory()) {
        return SKIPPED_DIRECTORIES.has(entry.name) ? [] : DeclaredImports.sources({ folder: path });
      }

      return SOURCE_PATTERN.test(entry.name) && !DECLARATION_PATTERN.test(entry.name) ? [path] : [];
    });
  }

  /** The names `package.json` of `folder` declares, in any dependency field, and its own name. */
  static declared(opts: { folder: string }): Set<string> {
    const manifest: unknown = JSON.parse(readFileSync(join(opts.folder, 'package.json'), 'utf8'));
    const names = new Set<string>();

    if (typeof manifest !== 'object' || manifest === null) {
      return names;
    }

    for (const [field, value] of Object.entries(manifest)) {
      if (DEPENDENCY_FIELDS.includes(field) && typeof value === 'object' && value !== null) {
        Object.keys(value).forEach((name) => names.add(name));
      }

      if (field === 'name' && typeof value === 'string') {
        names.add(value);
      }
    }

    return names;
  }

  /**
   * The packages the app imports without declaring them, each with a file that imports it
   * (`name (src/main.ts)`), sorted. Imports in comments and strings are not imports: the TypeScript
   * scanner finds `import`, `export ... from`, `import()` and `require()`.
   */
  static undeclared(opts: { folder: string }): string[] {
    const declared = DeclaredImports.declared({ folder: opts.folder });
    const firstFile = new Map<string, string>();

    // sorted, so the file named for a package is the same on every machine
    for (const file of DeclaredImports.sources({ folder: opts.folder }).sort()) {
      const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);

      for (const { fileName } of importedFiles) {
        const name = DeclaredImports.packageOf({ specifier: fileName });

        if (name !== null && !declared.has(name) && !firstFile.has(name)) {
          firstFile.set(name, relative(opts.folder, file));
        }
      }
    }

    return [...firstFile].map(([name, file]) => `${name} (${file})`).sort();
  }
}
