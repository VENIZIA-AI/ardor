import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SCANNED = ['docs/wiki/content', '.agents/knowledge', 'packages/ardor/README.md', 'README.md'];
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', '.vitepress']);
const TEXT_FILE = /\.(md|mts|ts|yaml|yml|json)$/;

/**
 * `bun x <name>` and `bunx <name>` run what `node_modules/.bin` holds, and fetch the package of that
 * name from npm when it holds nothing: an unscoped name can be somebody else's code. A scoped
 * `@venizia/...` name is ours; anything else needs `--no-install`. `shadcn` is the one CLI that is
 * fetched on purpose: it is not installed in the app, and running it is how a component is added.
 */
const BARE_BUNX = /\b(?:bun x|bunx)\s+(?!--no-install\b|@venizia\/|shadcn\b)(?!-)[a-z][\w.-]*/g;

const filesUnder = (opts: { path: string }): string[] => {
  if (TEXT_FILE.test(opts.path)) {
    return [opts.path];
  }

  return readdirSync(join(ROOT, opts.path), { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_FOLDERS.has(entry.name)) {
      return [];
    }

    const path = join(opts.path, entry.name);

    return entry.isDirectory() ? filesUnder({ path }) : TEXT_FILE.test(path) ? [path] : [];
  });
};

describe('documented bunx commands', () => {
  test('every unscoped name runs with --no-install', () => {
    const offenders = SCANNED.flatMap((path) => filesUnder({ path })).flatMap((file) => {
      const text = readFileSync(join(ROOT, file), 'utf8');

      return text.split('\n').flatMap((line, index) => {
        return [...line.matchAll(BARE_BUNX)].map((match) => `${file}:${index + 1} ${match[0]}`);
      });
    });

    expect(offenders).toEqual([]);
  });
});
