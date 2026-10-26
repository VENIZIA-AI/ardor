import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { build, type InlineConfig, type PluginOption } from 'vite';

// Scratch folders live inside the repository, under the gitignored .agents/local/tmp, never in the
// system temp folder (the same rule as scripts/scratch.ts, which a package cannot import).
const SCRATCH_ROOT = resolve(import.meta.dir, '../../../../../.agents/local/tmp');

export const makeScratch = (opts: { prefix: string }): string => {
  mkdirSync(SCRATCH_ROOT, { recursive: true });

  return mkdtempSync(join(SCRATCH_ROOT, opts.prefix));
};

/** Removes a folder made by makeScratch, and refuses any other. */
export const removeScratch = (opts: { root: string }): void => {
  if (!opts.root.startsWith(`${SCRATCH_ROOT}/`)) {
    throw new Error(`[removeScratch] ${opts.root} is not a scratch folder`);
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
  const target = realpathSync(resolve(import.meta.dir, '../../../node_modules', opts.name));
  const link = join(opts.root, 'node_modules', opts.name);

  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link, 'dir');
};

/** The whole node_modules of this workspace package, for a fixture that imports the real stack. */
export const linkAllInstalledPackages = (opts: { root: string }): void => {
  symlinkSync(
    realpathSync(resolve(import.meta.dir, '../../../node_modules')),
    join(opts.root, 'node_modules'),
    'dir',
  );
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
          codeSplitting: {
            groups: [...chunkGroups, { name: 'vendor', test: /node_modules/ }],
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

/** Loads the built entry in a fresh Node process, the way a browser loads it: as an ES module. */
export const runBuiltEntry = async (opts: { root: string }): Promise<IRunResult> => {
  const assets = join(opts.root, 'dist', 'assets');
  const entry = [...new Bun.Glob('main-*.js').scanSync({ cwd: assets })][0];

  if (entry === undefined) {
    throw new Error(`no main chunk in ${assets}`);
  }

  const child = Bun.spawn(['node', join(assets, entry)], {
    cwd: opts.root,
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
