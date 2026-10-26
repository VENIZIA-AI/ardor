import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';

import { COUNTS, HOME } from '../../../docs/wiki/site/.vitepress/theme/home-content';

const ROOT = join(import.meta.dir, '..', '..', '..');
const BROWSER_PACKAGES = ['kernel', 'react', 'admin'];

const TEST_FILE = /\.test\.tsx?$/;
const SOURCE_FILE = /\.tsx?$/;

const folders = (opts: { dir: string }): string[] =>
  readdirSync(join(ROOT, opts.dir), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(join(ROOT, opts.dir, entry.name, 'package.json')),
    )
    .map((entry) => entry.name);

/** Every file under `dir` (relative to the root), without node_modules and dist. */
const walk = (opts: { dir: string }): string[] =>
  readdirSync(join(ROOT, opts.dir), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      return [];
    }

    const path = `${opts.dir}/${entry.name}`;

    return entry.isDirectory() ? walk({ dir: path }) : [path];
  });

const BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));

/** The module names a source file imports, requires or re-exports from, `node:` prefix removed. */
const importedModules = (opts: { source: string }): string[] =>
  [...opts.source.matchAll(/(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1].replace(/^node:/, ''),
  );

/** What the home page counts, counted from the repository, so a number cannot go stale unnoticed. */
const counts = () => ({
  packages: folders({ dir: 'packages' }).length,
  examples: folders({ dir: 'examples' }).length,
  testFiles: [...walk({ dir: 'packages' }), ...walk({ dir: 'examples' })].filter((path) =>
    TEST_FILE.test(path),
  ).length,
  nodeBuiltins: BROWSER_PACKAGES.flatMap((name) => walk({ dir: `packages/${name}/src` }))
    .filter(
      (path) => SOURCE_FILE.test(path) && !TEST_FILE.test(path) && !path.includes('/__tests__/'),
    )
    .flatMap((path) => importedModules({ source: readFileSync(join(ROOT, path), 'utf8') }))
    .filter((name) => BUILTINS.has(name) || BUILTINS.has(name.split('/')[0])).length,
});

const statOf = (opts: { label: string }): number => {
  const stat = HOME.stats.find(([, label]) => label === opts.label);

  if (stat === undefined) {
    throw new Error(`home-content.ts has no stat labelled "${opts.label}"`);
  }

  return Number(stat[0]);
};

// A number on the first screen of the wiki is a claim: it is checked against the repository.
describe('the numbers on the home page', () => {
  test('COUNTS is what the repository holds', () => {
    expect(COUNTS, 'Update COUNTS in docs/wiki/site/.vitepress/theme/home-content.ts').toEqual(
      counts(),
    );
  });

  test('the proof strip shows COUNTS and nothing else', () => {
    expect(statOf({ label: 'packages' })).toBe(COUNTS.packages);
    expect(statOf({ label: 'examples' })).toBe(COUNTS.examples);
    expect(statOf({ label: 'test files' })).toBe(COUNTS.testFiles);
    expect(statOf({ label: 'Node builtins in the browser packages' })).toBe(COUNTS.nodeBuiltins);
    expect(HOME.stats).toHaveLength(4);
  });

  test('the counter sees a Node builtin when a browser package imports one', () => {
    const names = importedModules({
      source:
        "import { readFileSync } from 'node:fs';\nconst path = await import('path');\nimport x from 'react';",
    });

    expect(names.filter((name) => BUILTINS.has(name))).toEqual(['fs', 'path']);
  });
});

describe('the sentences of the home page', () => {
  test('the eyebrow carries the version and the Bun floor of the umbrella package', () => {
    const pkg: { version: string; engines: { bun: string } } = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'ardor', 'package.json'), 'utf8'),
    );

    expect(HOME.eyebrow).toBe(
      `ARDOR ${pkg.version} · MIT · Bun ${pkg.engines.bun.replace('>=', '')}+ · React`,
    );
    expect(HOME.version).toBe(pkg.version);
  });

  test('the lede is the description of the page in every meta tag', () => {
    const config = readFileSync(
      join(ROOT, 'docs', 'wiki', 'site', '.vitepress', 'config.mts'),
      'utf8',
    );

    // description, og:description and twitter:description
    expect(config.split(HOME.lede)).toHaveLength(4);
  });

  test('the install box holds the commands of the README', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

    for (const line of HOME.install.lines) {
      expect(readme).toContain(line);
    }
  });

  test('the code windows hold only lines of the preset files', () => {
    const preset = (opts: { path: string }): Set<string> =>
      new Set(
        readFileSync(join(ROOT, 'presets', 'app', 'files', opts.path), 'utf8')
          .split('\n')
          .map((line) => line.trim()),
      );
    const files: Record<string, Set<string>> = {
      'src/configurations/admin.configuration.ts': preset({
        path: 'src/configurations/admin.configuration.ts',
      }),
      'src/main.tsx': preset({ path: 'src/main.tsx' }),
    };
    const code = HOME.tabs.filter((tab) => tab.kind === 'code');

    expect(code.map((tab) => tab.file).sort()).toEqual(Object.keys(files).sort());

    for (const tab of code) {
      const invented = String(tab.body)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !files[tab.file].has(line));

      expect(invented, `${tab.file} has lines the preset file does not`).toEqual([]);
    }
  });

  test('every link of the home page and the footer is a page of the wiki', () => {
    const pages = new Set(
      walk({ dir: 'docs/wiki/content' })
        .filter((path) => path.endsWith('.md'))
        .map((path) => path.replace('docs/wiki/content', '').replace(/(index)?\.md$/, '')),
    );
    const internal = (href: string): boolean => href.startsWith('/') && !href.startsWith('//');
    const html = [HOME.maturityHtml, ...HOME.tabs.map((tab) => tab.note ?? '')].join(' ');
    const links = [
      ...HOME.cta.map(([, href]) => href),
      ...HOME.cells.flatMap((cell) => (cell.href === undefined ? [] : [cell.href])),
      ...[...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]),
    ].filter((href) => internal(href));

    expect(links.length).toBeGreaterThan(10);
    expect(links.filter((href) => !pages.has(href.replace(/\/$/, '')) && !pages.has(href))).toEqual(
      [],
    );
  });
});
