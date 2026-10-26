import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import type { IBuildInfoFile, TConstValue } from '@venizia/ardor-kernel';
import { BuildInfoResolver } from '@venizia/ignis-boot/build-info';
import { BuildInfoRegistry, type TBuildInfoRecord } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';

import { useQuietConsoleLogger } from './quiet-logger';

const runFile = promisify(execFile);

const GIT_TIMEOUT_MS = 5_000;
const COMMIT_LENGTH = 12;
const MANIFEST_FILE = 'package.json';

/** What to do when the commit is neither in the pipeline environment nor in git. */
export class UnresolvedPolicies {
  static readonly ERROR = 'error';
  static readonly UNSPECIFIED = 'unspecified';

  static readonly SCHEME_SET = new Set([this.ERROR, this.UNSPECIFIED]);

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

export type TUnresolvedPolicy = TConstValue<typeof UnresolvedPolicies>;

export type TGitReadResult = { ok: true; value: string } | { ok: false; reason: string };

export interface IFrameworkVersions {
  versions: Record<string, string>;
  /** Declared dependencies of the scope with no installed package.json: the install has not run. */
  missing: string[];
}

/** The effects of resolving the file; tests replace them, and the plugin passes the real ones. */
export interface IBuildInfoSources {
  resolveRecord(opts: { root: string }): Promise<TBuildInfoRecord>;
  readGit(opts: { root: string; args: string[] }): Promise<TGitReadResult>;
  readFrameworkVersions(opts: { root: string; scope: string }): Promise<IFrameworkVersions>;
}

export interface IBuildInfoResolution {
  info: IBuildInfoFile;
  warnings: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (opts: { record: Record<string, unknown>; key: string }): string | undefined => {
  const value = opts.record[opts.key];

  return typeof value === 'string' ? value : undefined;
};

const getKeys = (opts: { record: Record<string, unknown>; key: string }): string[] => {
  const value = opts.record[opts.key];

  return isRecord(value) ? Object.keys(value) : [];
};

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** `undefined` only when the file does not exist; an unreadable or malformed file is an error naming it. */
export const readJsonFile = async (opts: { path: string }): Promise<unknown> => {
  let text: string;

  try {
    text = await readFile(opts.path, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return undefined;
    }

    throw getError({ message: `[buildInfoFile] cannot read ${opts.path} | ${String(error)}` });
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw getError({
      message: `[buildInfoFile] ${opts.path} is not valid JSON | ${String(error)}`,
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

  for (const name of [...new Set(names)].sort()) {
    const version = await findInstalledVersion({ root, name });

    if (version === undefined) {
      missing.push(name);
    } else {
      versions[name] = version;
    }
  }

  return { versions, missing };
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

// TODO: delete when @venizia/ignis-boot reads git under Node (VENIZIA-AI/ignis#537): its resolver
// asks Bun for git, so under Node the commit and the branch come back unspecified.
export const completeFromGit = (opts: {
  record: TBuildInfoRecord;
  commit: TGitReadResult;
  branch: TGitReadResult;
}): TBuildInfoRecord => {
  const { record, commit, branch } = opts;

  return {
    ...record,
    commit:
      record.commit === BuildInfoRegistry.UNSPECIFIED && commit.ok ? commit.value : record.commit,
    branch:
      record.branch === BuildInfoRegistry.UNSPECIFIED && branch.ok ? branch.value : record.branch,
  };
};

export const toBuildInfoFile = (opts: {
  record: TBuildInfoRecord;
  frameworks: Record<string, string>;
}): IBuildInfoFile => ({
  service: opts.record.service,
  version: opts.record.version,
  commit: opts.record.commit,
  branch: opts.record.branch,
  builtAt: opts.record.builtAt,
  frameworks: Object.fromEntries(
    Object.entries(opts.frameworks).sort(([left], [right]) => left.localeCompare(right)),
  ),
});

/** The same input is always the same text: the key order is fixed, and the file ends with a newline. */
export const serializeBuildInfoFile = (opts: { info: IBuildInfoFile }): string =>
  `${JSON.stringify(toBuildInfoFile({ record: opts.info, frameworks: opts.info.frameworks }), null, 2)}\n`;

export const isBuildInfoRequest = (opts: {
  url: string | undefined;
  base: string;
  fileName: string;
}): boolean => {
  if (opts.url === undefined) {
    return false;
  }

  return opts.url.split('?')[0] === `${opts.base}${opts.fileName}`;
};

/** The stamp of IGNIS, with the commit and the branch from git when the pipeline gave none, and the framework versions. */
export const resolveBuildInfo = async (opts: {
  root: string;
  scope: string;
  policy: TUnresolvedPolicy;
  sources: IBuildInfoSources;
}): Promise<IBuildInfoResolution> => {
  const { root, scope, policy, sources } = opts;
  const warnings: string[] = [];

  const stamp = await sources.resolveRecord({ root });
  const [commit, branch, frameworks] = await Promise.all([
    sources.readGit({ root, args: ['rev-parse', `--short=${COMMIT_LENGTH}`, 'HEAD'] }),
    sources.readGit({ root, args: ['rev-parse', '--abbrev-ref', 'HEAD'] }),
    sources.readFrameworkVersions({ root, scope }),
  ]);
  const record = completeFromGit({ record: stamp, commit, branch });

  if (!commit.ok && record.commit === BuildInfoRegistry.UNSPECIFIED) {
    const message = `[buildInfoFile] no commit | The pipeline gave none (APP_BUILD_COMMIT or the CI variable of your host) and ${commit.reason}. Build inside a git checkout, or set APP_BUILD_COMMIT`;

    if (policy === UnresolvedPolicies.ERROR) {
      throw getError({ message });
    }

    warnings.push(message);
  }

  if (!branch.ok && record.branch === BuildInfoRegistry.UNSPECIFIED) {
    warnings.push(
      `[buildInfoFile] no branch | The pipeline gave none (APP_BUILD_BRANCH) and ${branch.reason}`,
    );
  }

  for (const name of frameworks.missing) {
    warnings.push(
      `[buildInfoFile] ${name} is a dependency with no installed package.json | Run the install`,
    );
  }

  return {
    info: toBuildInfoFile({ record, frameworks: frameworks.versions }),
    warnings,
  };
};

export const defaultSources: IBuildInfoSources = {
  resolveRecord: (opts) => {
    useQuietConsoleLogger();

    return BuildInfoResolver.getInstance().resolve({ root: opts.root });
  },
  readGit,
  readFrameworkVersions,
};
