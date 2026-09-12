/**
 * config.ts - the ONLY repo-specific configuration for the OKF knowledge tooling.
 *
 * Everything that knows the shape of THIS repository lives here: paths, denylists,
 * section order/labels, and the coverage axes. Porting the bundle to another repo
 * means editing this file; okf.ts / lib.ts / viz.ts stay untouched.
 *
 * Renderers themselves are code, not config - they live in the RENDERERS registry
 * at the top of okf.ts and read their paths from here.
 */
import { resolve } from 'node:path';

export const REPO = resolve(import.meta.dir, '../..');
export const BUNDLE = resolve(REPO, '.agents/knowledge');

/** Directories never walked when scanning source. */
export const PRUNE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  'coverage',
  '.cache',
  '.vitepress',
  '.claude',
  '__tests__',
]);

export const PATHS = {
  packages: resolve(REPO, 'packages'),
  examples: resolve(REPO, 'examples'),
  docs: resolve(REPO, 'docs/wiki'),
  /** Binding keys the framework declares (`CoreBindings`, `LocalStorageKeys`). */
  coreBindings: resolve(REPO, 'packages/kernel/src/common/keys.ts'),
  /** Provider classes, by package: the react-admin adapters and the kernel base. */
  providerDirs: [
    resolve(REPO, 'packages/admin/src/providers'),
    resolve(REPO, 'packages/kernel/src/base/providers'),
  ],
  /** Hook modules, by package: every exported `use*` is a catalog row. */
  hookDirs: [resolve(REPO, 'packages/react/src/hooks'), resolve(REPO, 'packages/admin/src/hooks')],
  /** Service classes shipped by the framework. */
  serviceDirs: [
    resolve(REPO, 'packages/kernel/src/base/services'),
    resolve(REPO, 'packages/admin/src/services'),
  ],
  makefile: resolve(REPO, 'Makefile'),
} as const;

/**
 * Scaffold or non-concept directories. `docs` under packages/ does not exist in ARDOR (the wiki is
 * docs/wiki); every packages/* and examples/* dir is a real artifact that earns a concept.
 */
export const PACKAGE_DENYLIST = new Set<string>([]);
export const EXAMPLE_DENYLIST = new Set<string>([]);

/** Bundle sections, in display order (viz + index). Unknown sections sort in after these. */
export const SECTION_ORDER = [
  'overview',
  'architecture',
  'packages',
  'conventions',
  'process',
  'examples',
  'reference',
] as const;

export const SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  architecture: 'Architecture',
  packages: 'Packages',
  conventions: 'Conventions',
  process: 'Process',
  examples: 'Examples',
  reference: 'Reference',
};

/** Reserved OKF filenames that carry no `type:` frontmatter and are never counted as concepts. */
export const RESERVED_FILES = new Set(['index.md', 'log.md']);
