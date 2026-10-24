import React from 'react';

import { Logger } from '@venizia/ardor-kernel';

const logger = Logger.getInstance({ scope: 'useCopyToClipboard' });

export interface IUseCopyToClipboardReturn {
  copy: (opts: { value: string }) => Promise<boolean>;
}

export const useCopyToClipboard = (): IUseCopyToClipboardReturn => {
  const copy = React.useCallback(async (opts: { value: string }) => {
    if (!navigator?.clipboard) {
      logger.warn('[copy] The clipboard is not supported');
      return false;
    }

    const { value } = opts;

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      logger.warn('[copy] Copy failed | error: %s', error);
      return false;
    }
  }, []);

  return { copy };
};
