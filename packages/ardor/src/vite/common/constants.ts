export const DEFAULT_BUILD_INFO_FILE_NAME = 'build-info.json';
export const DEFAULT_FRAMEWORK_SCOPE = '@venizia/';

/** What to do when the commit is neither in the pipeline environment nor in git. */
export class UnresolvedPolicies {
  static readonly ERROR = 'error';
  static readonly UNSPECIFIED = 'unspecified';

  static readonly SCHEME_SET = new Set([this.ERROR, this.UNSPECIFIED]);

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}
