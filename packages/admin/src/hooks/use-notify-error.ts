import React from 'react';

import type { ApplicationError } from '@venizia/ignis-inversion';
import type { NotificationOptions, NotificationType } from 'ra-core';
import { useNotify } from 'ra-core';

/**
 * Returns a stable function that shows an error notification for an `ApplicationError`: the message
 * is its normalized `code`, with its normalized `args` as message arguments. `options` override both.
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
      notify(error.normalized?.code, {
        type: 'error',
        messageArgs: error.normalized?.args,
        ...options,
      });
    },
    [notify],
  );
};
