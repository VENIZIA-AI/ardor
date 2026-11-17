/**
 * A `@venizia/*` dependency is `catalog:`, `workspace:` or one exact version (the VULCAN pin of the root),
 * never a range: `devz check catalog` only fails a range for an entry the catalog owns. Peers are ranges.
 *
 * Usage: bun scripts/checks/catalog-scope.ts
 */
import { Glob } from 'bun';
import { resolve } from 'node:path';

export type TManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const ALLOWED = /^(?:catalog:|workspace:|\d+\.\d+\.\d+(?:-[\w.]+)?$)/;

export const strays = (opts: { manifest: TManifest }): string[] => {
  const { dependencies = {}, devDependencies = {} } = opts.manifest;

  return [dependencies, devDependencies].flatMap((block) => {
    return Object.entries(block)
      .filter(([name, range]) => name.startsWith('@venizia/') && !ALLOWED.test(range))
      .map(([name, range]) => `${name} is "${range}"`);
  });
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..', '..');
  const found: string[] = [];

  for (const pattern of ['package.json', '{packages,docs,examples}/*/package.json']) {
    for (const path of new Glob(pattern).scanSync({ cwd: root })) {
      const manifest = await Bun.file(resolve(root, path)).json();
      found.push(...strays({ manifest }).map((stray) => `${path}: ${stray}`));
    }
  }

  if (found.length > 0) {
    console.error(
      `catalog-scope: use "catalog:" and list the package in the root catalog:\n  ${found.join('\n  ')}`,
    );
    process.exit(1);
  }
}
