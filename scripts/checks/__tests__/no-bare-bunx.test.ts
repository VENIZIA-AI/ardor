import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SCANNED = [
  'docs/wiki/content',
  '.agents/knowledge',
  '.github',
  'presets',
  'scripts',
  'make',
  'README.md',
  'packages/ardor/README.md',
  'packages/kernel/README.md',
  'packages/react/README.md',
  'packages/admin/README.md',
];
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', '.vitepress']);
const SKIPPED_FILES = new Set(['scripts/checks/__tests__/no-bare-bunx.test.ts']);
const TEXT_FILE = /\.(md|mts|ts|tsx|sh|yaml|yml|json|mk)$|\/Makefile$/;

/** The runner, the flags that follow it, and the name it runs. */
const RUNNER = /\b(?:bun\s+x|bunx)((?:\s+--?[\w-]+(?:=\S+)?)*)\s+["']?(@?[A-Za-z0-9][\w./@-]*)/g;

/** Scoped to us, or fetched on purpose: not installed in the app, and running it is how a component is added. */
const ALLOWED_NAME = /^(?:@venizia(?:\/|$)|shadcn$)/;

/**
 * `bun x <name>` and `bunx <name>` run what `node_modules/.bin` holds, and fetch the package of that
 * name from npm when it holds nothing: an unscoped name can be somebody else's code. A `@venizia/...`
 * name is ours; anything else needs `--no-install`.
 */
const offendersIn = (opts: { text: string }): string[] => {
  return [...opts.text.matchAll(RUNNER)].flatMap((match) => {
    const [command, flags = '', name = ''] = match;

    return /--no-install\b/.test(flags) || ALLOWED_NAME.test(name) ? [] : [command.trim()];
  });
};

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
  test('the check sees a bare name, flags before it, and a name in quotes', () => {
    expect(offendersIn({ text: 'run bunx ardor codemod' })).toHaveLength(1);
    expect(offendersIn({ text: 'run bun x devz codemod' })).toHaveLength(1);
    expect(offendersIn({ text: 'run bunx -y ardor' })).toHaveLength(1);
    expect(offendersIn({ text: 'run bun  x --bun ardor' })).toHaveLength(1);
    expect(offendersIn({ text: 'run bunx "ardor"' })).toHaveLength(1);
    expect(offendersIn({ text: 'run bunx @evil/ardor' })).toHaveLength(1);
    expect(offendersIn({ text: 'run bunx shadcn-ui' })).toHaveLength(1);
  });

  test('the check lets --no-install, our own scope and shadcn through', () => {
    expect(offendersIn({ text: 'run bun x --no-install ardor codemod' })).toEqual([]);
    expect(offendersIn({ text: 'run bunx --bun --no-install ardor' })).toEqual([]);
    expect(offendersIn({ text: 'bun x @venizia/vulcan@0.4.10-16 init' })).toEqual([]);
    expect(offendersIn({ text: 'bunx shadcn init' })).toEqual([]);
  });

  test('every documented unscoped name runs with --no-install', () => {
    const offenders = SCANNED.flatMap((path) => filesUnder({ path }))
      .filter((file) => !SKIPPED_FILES.has(file))
      .flatMap((file) => {
        const text = readFileSync(join(ROOT, file), 'utf8');

        return text.split('\n').flatMap((line, index) => {
          return offendersIn({ text: line }).map((command) => `${file}:${index + 1} ${command}`);
        });
      });

    expect(offenders).toEqual([]);
  });
});
