import type { IBuildInfoFile, TConstValue } from '@venizia/ardor-kernel';
import type { TBuildInfoRecord } from '@venizia/ignis-helpers/core';

import type { UnresolvedPolicies } from './constants';

export type TUnresolvedPolicy = TConstValue<typeof UnresolvedPolicies>;

export interface IBuildInfoFileOptions {
  /** The app folder, where its package.json is. Default: the folder Vite runs in. */
  root?: string;
  /** The file's path under the output folder and under the dev server's base. Default: `build-info.json`. */
  fileName?: string;
  /** Dependencies whose name starts with this are listed under `frameworks`. Default: `@venizia/`. */
  frameworkScope?: string;
  /** What a build does when no commit can be found: `error` (default) or `unspecified`. The dev server always serves what it has and warns. */
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
