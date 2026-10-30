import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { BuildInfoResolver } from '@venizia/ignis-boot/build-info';
import { getError } from '@venizia/ignis-inversion';

import type { IBuildInfoSources, IFrameworkVersions, TGitReadResult } from './common';
import { useQuietConsoleLogger } from './quiet-logger';

const runFile = promisify(execFile);

const GIT_TIMEOUT_MS = 5_000;
const MANIFEST_FILE = 'package.json';
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

// A type guard takes its argument as it is: that is what it narrows.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (opts: { record: Record<string, unknown>; key: string }): string | undefined => {
  const value = opts.record[opts.key];

  return typeof value === 'string' ? value : undefined;
};

const getKeys = (opts: { record: Record<string, unknown>; key: string }): string[] => {
  const value = opts.record[opts.key];

  return typeof value === 'object' && value !== null ? Object.keys(value) : [];
};

/** The error code or name only: a message can quote the content of a file that was never meant to be read. */
const describeError = (opts: { error: unknown }): string => {
  const { error } = opts;

  if (!(error instanceof Error)) {
    return 'unknown error';
  }

  return 'code' in error && typeof error.code === 'string' ? error.code : error.name;
};

/** `undefined` only when the file does not exist; an unreadable or malformed file is an error naming it. */
export const readJsonFile = async (opts: { path: string }): Promise<unknown> => {
  let text: string;

  try {
    const result = await readFile(opts.path, 'utf8');
    text = result;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw getError({
      message: `[buildInfoFile] cannot read ${opts.path} | ${describeError({ error })}`,
    });
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw getError({
      message: `[buildInfoFile] ${opts.path} is not valid JSON | ${describeError({ error })}`,
    });
  }
};

/** The version of the package as Node would find it: the nearest `node_modules` upward from the app. */
export const findInstalledVersion = async (opts: {
  root: string;
  name: string;
}): Promise<string | undefined> => {
  let directory = opts.root;

  for (;;) {
    const manifest = await readJsonFile({
      path: join(directory, 'node_modules', opts.name, MANIFEST_FILE),
    });

    if (isRecord(manifest)) {
      return getString({ record: manifest, key: 'version' });
    }

    const parent = dirname(directory);

    if (parent === directory) {
      return undefined;
    }

    directory = parent;
  }
};

/** The installed version of every dependency of the app whose name starts with the scope, by name. */
export const readFrameworkVersions = async (opts: {
  root: string;
  scope: string;
}): Promise<IFrameworkVersions> => {
  const { root, scope } = opts;
  const manifest = await readJsonFile({ path: join(root, MANIFEST_FILE) });

  if (!isRecord(manifest)) {
    throw getError({
      message: `[buildInfoFile] no ${MANIFEST_FILE} in ${root} | Pass the app folder as the root option`,
    });
  }

  const names = [
    ...getKeys({ record: manifest, key: 'dependencies' }),
    ...getKeys({ record: manifest, key: 'devDependencies' }),
  ].filter((name) => name.startsWith(scope));

  const versions: Record<string, string> = {};
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const name of [...new Set(names)].sort()) {
    // The name becomes a path: only a real package name may be looked up.
    if (!PACKAGE_NAME.test(name)) {
      invalid.push(name);
      continue;
    }

    const version = await findInstalledVersion({ root, name });

    if (version === undefined) {
      missing.push(name);
    } else {
      versions[name] = version;
    }
  }

  return { versions, missing, invalid };
};

/** Runs git without a shell, so no argument is ever interpreted. */
export const readGit = async (opts: { root: string; args: string[] }): Promise<TGitReadResult> => {
  try {
    const { stdout } = await runFile('git', opts.args, {
      cwd: opts.root,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    });
    const value = stdout.trim();

    return value === ''
      ? { ok: false, reason: `git ${opts.args.join(' ')} printed nothing` }
      : { ok: true, value };
  } catch (error) {
    return { ok: false, reason: `git ${opts.args.join(' ')} failed | ${String(error)}` };
  }
};

export const defaultSources: IBuildInfoSources = {
  resolveRecord: (opts) => {
    useQuietConsoleLogger();

    return BuildInfoResolver.getInstance().resolve({ root: opts.root });
  },
  readGit,
  readFrameworkVersions,
};
