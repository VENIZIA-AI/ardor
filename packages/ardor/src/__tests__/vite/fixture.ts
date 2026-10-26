import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { getError } from '@venizia/ignis-inversion';
import { build, type InlineConfig, type PluginOption } from 'vite';

export const REPOSITORY_ROOT = resolve(import.meta.dir, '../../../../..');

const SCRATCH_ROOT = join(REPOSITORY_ROOT, '.agents', 'local', 'tmp');
const PACKAGE_NODE_MODULES = resolve(import.meta.dir, '../../../node_modules');

// The rule of scripts/scratch.ts, which a package cannot import (its rootDir is src): scratch lives
// inside the repository, never in the system temp folder.
export const makeScratch = (opts: { prefix: string }): string => {
  mkdirSync(SCRATCH_ROOT, { recursive: true });

  return mkdtempSync(join(SCRATCH_ROOT, opts.prefix));
};

/** Removes a folder made by makeScratch, and refuses any other, whatever path it is spelled with. */
export const removeScratch = (opts: { root: string }): void => {
  const inside = relative(SCRATCH_ROOT, resolve(opts.root));

  if (inside === '' || inside.startsWith('..') || inside.startsWith('/')) {
    throw getError({ message: `[removeScratch] ${opts.root} is not inside the scratch folder` });
  }

  rmSync(opts.root, { recursive: true, force: true });
};

export const writeFiles = (opts: { root: string; files: Record<string, string> }): void => {
  for (const [path, content] of Object.entries(opts.files)) {
    const target = join(opts.root, path);

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
};

/** The installed package of this workspace package, linked into the fixture's node_modules. */
export const linkInstalledPackage = (opts: { root: string; name: string }): void => {
  const link = join(opts.root, 'node_modules', opts.name);

  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(realpathSync(join(PACKAGE_NODE_MODULES, opts.name)), link, 'dir');
};

/** The whole node_modules of this workspace package, for a fixture that imports the real stack. */
export const linkAllInstalledPackages = (opts: { root: string }): void => {
  symlinkSync(realpathSync(PACKAGE_NODE_MODULES), join(opts.root, 'node_modules'), 'dir');
};

export interface IFixtureBuildOptions {
  root: string;
  plugins?: PluginOption[];
  strictExecutionOrder?: boolean;
  /** Split each of these module patterns into a chunk of its own, then the rest of node_modules into `vendor`. */
  chunkGroups?: Array<{ name: string; test: RegExp }>;
}

/** A production build of `src/main.ts` of the fixture, written to its `dist`. */
export const buildFixture = async (opts: IFixtureBuildOptions): Promise<void> => {
  const { root, plugins = [], strictExecutionOrder, chunkGroups = [] } = opts;

  const config: InlineConfig = {
    root,
    configFile: false,
    logLevel: 'silent',
    plugins,
    build: {
      outDir: 'dist',
      minify: false,
      rolldownOptions: {
        input: 'src/main.ts',
        output: {
          strictExecutionOrder,
          codeSplitting: { groups: [...chunkGroups, { name: 'vendor', test: /node_modules/ }] },
        },
      },
    },
  };

  await build(config);
};

export interface IRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs Node in a fresh process and collects what it printed. */
export const runNode = async (opts: {
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}): Promise<IRunResult> => {
  const child = Bun.spawn(['node', ...opts.args], {
    cwd: opts.cwd,
    env: opts.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { exitCode, stdout, stderr };
};

/** Loads the built entry the way a browser loads it: as an ES module. */
export const runBuiltEntry = (opts: { root: string }): Promise<IRunResult> => {
  const assets = join(opts.root, 'dist', 'assets');
  const [entry] = [...new Bun.Glob('main-*.js').scanSync({ cwd: assets })];

  if (entry === undefined) {
    throw getError({ message: `[runBuiltEntry] no main chunk in ${assets}` });
  }

  return runNode({ args: [join(assets, entry)], cwd: opts.root });
};
