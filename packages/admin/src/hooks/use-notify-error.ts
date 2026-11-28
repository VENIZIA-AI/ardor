import React from 'react';

import { HTTP } from '@venizia/ignis-helpers/common';
import type { ApplicationError } from '@venizia/ignis-inversion';
import type { NotificationOptions, NotificationType } from 'ra-core';
import { useNotify } from 'ra-core';

/** A 502 raised where the response is read, with a text of its own in ARDOR's catalogues. */
const SCHEMA_MISMATCH_CODE = 'core.fetch.schema_mismatch';

const isServerFailure = (error: ApplicationError) => {
  return (
    error.statusCode >= HTTP.ResultCodes.RS_5.InternalServerError &&
    error.normalized?.code !== SCHEMA_MISMATCH_CODE
  );
};

/**
 * Returns a stable function that shows an error notification for an `ApplicationError`: the message
 * is its normalized `code`, with its normalized `args` as message arguments. A 5xx shows
 * `ra.notification.http_error` with no arguments, unless its code is `core.fetch.schema_mismatch`.
 * `options` override the type and the arguments.
 */
export const useNotifyError = () => {
  const notify = useNotify();

  return React.useCallback(
    (
      error: ApplicationError,
      options?: NotificationOptions & {
        type?: NotificationType;
      },
    ) => {
      const isGeneric = isServerFailure(error);

      notify(isGeneric ? 'ra.notification.http_error' : error.normalized?.code, {
        type: 'error',
        messageArgs: isGeneric ? undefined : error.normalized?.args,
        ...options,
      });
    },
    [notify],
  );
};
