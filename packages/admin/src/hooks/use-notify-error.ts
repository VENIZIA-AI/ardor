import React from 'react';

import type { ApplicationError } from '@venizia/ignis-inversion';
import type { NotificationOptions, NotificationType } from 'ra-core';
import { useNotify } from 'ra-core';

import { ServerErrorUtility } from '@/utilities/server-error';

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
      const isGeneric = ServerErrorUtility.isHidden({ error });

      notify(isGeneric ? ServerErrorUtility.MESSAGE_KEY : error.normalized?.code, {
        type: 'error',
        messageArgs: isGeneric ? undefined : error.normalized?.args,
        ...options,
      });
    },
    [notify],
  );
};
