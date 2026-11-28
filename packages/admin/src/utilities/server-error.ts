import { HTTP } from '@venizia/ignis-helpers/common';
import { type ApplicationError, getError, isApplicationError } from '@venizia/ignis-inversion';

/** A 502 raised where the response is read, with a text of its own in ARDOR's catalogues. */
const SCHEMA_MISMATCH_CODE = 'core.fetch.schema_mismatch';

/** What the user is told about a 5xx: the server hides what failed. */
export class ServerErrorUtility {
  static readonly MESSAGE_KEY = 'ra.notification.http_error';

  /** A status of 500 or higher, the response schema mismatch aside. */
  static isHidden(opts: { error: ApplicationError }): boolean {
    const { statusCode, normalized } = opts.error;

    return (
      statusCode >= HTTP.ResultCodes.RS_5.InternalServerError &&
      normalized?.code !== SCHEMA_MISMATCH_CODE
    );
  }

  /**
   * A hidden error again with `MESSAGE_KEY` as its message, which react-admin's own notifications
   * translate; the error itself is the `cause`. Anything else comes back as it is.
   */
  static toDisplayed(opts: { error: unknown }): unknown {
    const { error } = opts;

    if (!isApplicationError(error) || !ServerErrorUtility.isHidden({ error })) {
      return error;
    }

    return getError({
      statusCode: error.statusCode,
      message: ServerErrorUtility.MESSAGE_KEY,
      messageCode: error.normalized.code,
      messageArgs: error.normalized.args,
      extra: error.extra,
      cause: error,
    });
  }
}
