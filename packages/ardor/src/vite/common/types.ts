import type { IBuildInfoFile, TConstValue } from '@venizia/ardor-kernel';
import type { TBuildInfoRecord } from '@venizia/ignis-helpers/core';

import type { UnresolvedPolicies } from './constants';

/** `'error'` or `'unspecified'`; see `UnresolvedPolicies`. */
export type TUnresolvedPolicy = TConstValue<typeof UnresolvedPolicies>;

/** The options of the `buildInfoFile` plugin. */
export interface IBuildInfoFileOptions {
  /**
   * The app folder, where its package.json is.
   * @default process.cwd()
   */
  root?: string;
  /**
   * The file's path under the output folder and under the dev server's base.
   * A relative path of letters, digits, `.`, `_` and `-`, with `/` between folders, ending `.json`, and
   * no `..` segment; anything else throws.
   * @default 'build-info.json'
   */
  fileName?: string;
  /**
   * Dependencies whose name starts with this are listed under `frameworks`.
   * @default '@venizia/'
   */
  frameworkScope?: string;
  /**
   * What a build does when no commit can be found: `error` or `unspecified`. The dev server always serves what it has and warns.
   * @default UnresolvedPolicies.ERROR
   */
  onUnresolved?: TUnresolvedPolicy;
}

export type TGitReadResult = { ok: true; value: string } | { ok: false; reason: string };

export interface IFrameworkVersions {
  versions: Record<string, string>;
  /** Declared dependencies of the scope with no installed package.json: the install has not run. */
  missing: string[];
  /** Declared dependencies of the scope whose name is not a package name; they are never looked up. */
  invalid: string[];
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
