import { isApplicationError } from '@venizia/ignis-inversion';

import { SESSION_CHANGED_CODE } from '@venizia/ardor-kernel';

/** What a failure says of the session, whoever made it. */
export class ErrorStatusUtility {
  /** Whether it is the 401 of a request whose session has ended since (`SESSION_CHANGED_CODE`). */
  static isSessionChanged(opts: { error: unknown }): boolean {
    const { error } = opts;

    return isApplicationError(error) && error.normalized.code === SESSION_CHANGED_CODE;
  }

  /** react-admin's `HttpError` has `status`, the data provider's `ApplicationError` has `statusCode`. */
  static read(opts: { error: unknown }): unknown {
    const { error } = opts;

    if (typeof error !== 'object' || error === null) {
      return undefined;
    }

    const status = 'status' in error ? error.status : undefined;

    return status ?? ('statusCode' in error ? error.statusCode : undefined);
  }
}
