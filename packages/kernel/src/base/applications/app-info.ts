import { getError } from '@venizia/ignis-inversion';

import { LocalStorageKeys } from '@/common';

/** Checks the `IApplicationInfo` that `getAppInfo()` returned, so `start()` rejects a bad one at boot. */
export class ApplicationInfoGuard {
  /** Throws a coded error when `name` is not a non-blank string, `version` is not a string, or `id` is not a valid scope id. */
  static assert(opts: { info: unknown }): void {
    const { info } = opts;

    if (typeof info !== 'object' || info === null) {
      throw getError({
        message:
          '[appInfo] getAppInfo() must return an object | Return { name, version, description }',
      });
    }

    const name: unknown = Reflect.get(info, 'name');
    const version: unknown = Reflect.get(info, 'version');
    const id: unknown = Reflect.get(info, 'id');

    if (typeof name !== 'string' || name.trim() === '') {
      throw getError({
        message:
          '[appInfo] IApplicationInfo.name must be a non-empty string | Set the name in getAppInfo()',
      });
    }

    if (typeof version !== 'string') {
      throw getError({
        message:
          '[appInfo] IApplicationInfo.version must be a string | Set the version in getAppInfo()',
      });
    }

    if (id === undefined) {
      return;
    }

    if (typeof id !== 'string') {
      throw getError({
        message:
          '[appInfo] IApplicationInfo.id must be a string | Set the id in getAppInfo(), or leave it out',
      });
    }

    // Throws for an id that is not letters, digits, '.', '_' and '-'.
    LocalStorageKeys.scoped({ id });
  }
}
