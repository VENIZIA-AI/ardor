import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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
  /**
   * The closing `vendor` group. By default the catch-all of `/node_modules/` that the strict-order tests need;
   * `false` leaves it out, as the preset does; an object sets its options (the opt-in of the Vite setup guide).
   */
  vendorGroup?: false | { minShareCount?: number; entriesAware?: boolean };
}

/** A production build of `src/main.ts` of the fixture, written to its `dist`. */
export const buildFixture = async (opts: IFixtureBuildOptions): Promise<void> => {
  const { root, plugins = [], strictExecutionOrder, chunkGroups = [], vendorGroup = {} } = opts;

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
          codeSplitting: {
            groups: [
              ...chunkGroups,
              ...(vendorGroup === false
                ? []
                : [{ name: 'vendor', test: /node_modules/, ...vendorGroup }]),
            ],
          },
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

export interface IBuiltChunk {
  file: string;
  /** Raw size in bytes. */
  size: number;
  code: string;
}

/** Every JavaScript chunk a fixture build wrote. */
export const readChunks = (opts: { root: string }): IBuiltChunk[] => {
  const assets = join(opts.root, 'dist', 'assets');

  return [...new Bun.Glob('*.js').scanSync({ cwd: assets })].map((file) => {
    const code = readFileSync(join(assets, file), 'utf8');

    return { file, size: Buffer.byteLength(code), code };
  });
};

/**
 * The chunks a browser fetches for the first screen: the main chunk and everything it imports
 * statically, at any depth. A chunk reached only by a dynamic `import()` is not in it.
 */
export const firstLoadChunks = (opts: { root: string }): IBuiltChunk[] => {
  const chunks = new Map(readChunks(opts).map((chunk) => [chunk.file, chunk]));
  const main = [...chunks.values()].find((chunk) => chunk.file.startsWith('main-'));

  if (!main) {
    throw getError({ message: `[firstLoadChunks] no main chunk in ${opts.root}` });
  }

  const loaded = new Set<IBuiltChunk>();

  const visit = (chunk: IBuiltChunk): void => {
    if (loaded.has(chunk)) {
      return;
    }

    loaded.add(chunk);

    // `import x from "./a.js"`, `export * from "./a.js"` and `import "./a.js"`; `import("./a.js")` has a parenthesis first.
    for (const match of chunk.code.matchAll(
      /(?:import|export)\s*(?:[^'"(]*?from\s*)?["']\.\/([^"']+)["']/g,
    )) {
      const dependency = chunks.get(match[1] ?? '');

      if (dependency) {
        visit(dependency);
      }
    }
  };

  visit(main);

  return [...loaded];
};
