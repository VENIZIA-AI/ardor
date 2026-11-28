import React from 'react';

import { NETWORK_TIMEOUT_CODE } from '@venizia/ardor-kernel';
import { HTTP } from '@venizia/ignis-helpers/common';
import type { ApplicationError } from '@venizia/ignis-inversion';
import type { NotificationOptions, NotificationType } from 'ra-core';
import { useNotify } from 'ra-core';

/** The 5xx errors ARDOR raises itself, in the browser: their code says what happened. */
const OWN_SERVER_ERROR_CODES = new Set(['core.fetch.schema_mismatch', NETWORK_TIMEOUT_CODE]);

const isServerFailure = (error: ApplicationError) => {
  return (
    error.statusCode >= HTTP.ResultCodes.RS_5.InternalServerError &&
    !OWN_SERVER_ERROR_CODES.has(error.normalized?.code)
  );
};

/**
 * Returns a stable function that shows an error notification for an `ApplicationError`: the message
 * is its normalized `code`, with its normalized `args` as message arguments. A 5xx shows
 * `ra.notification.http_error` with no arguments, unless ARDOR raised it itself (a timeout, a
 * response schema mismatch). `options` override the type and the arguments.
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
