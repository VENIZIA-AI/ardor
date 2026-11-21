import { ConstClass } from '@venizia/ignis-helpers/common';

/** The build info file's path when `fileName` is not set. */
export const DEFAULT_BUILD_INFO_FILE_NAME = 'build-info.json';
/** The package-name prefix listed under `frameworks` when `frameworkScope` is not set. */
export const DEFAULT_FRAMEWORK_SCOPE = '@venizia/';

/** What to do when the commit is neither in the pipeline environment nor in git. */
export class UnresolvedPolicies extends ConstClass {
  /** The build fails. */
  static readonly ERROR = 'error';
  /** The build goes on with the commit recorded as `unspecified`. */
  static readonly UNSPECIFIED = 'unspecified';
}
