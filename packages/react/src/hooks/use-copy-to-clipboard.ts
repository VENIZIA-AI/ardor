import { LoggerFactory } from '@venizia/ignis-helpers/core';

import { BrowserClipboard } from '@venizia/ardor-kernel';

const logger = LoggerFactory.getLogger(['useCopyToClipboard']);

export interface IUseCopyToClipboardReturn {
  copy: (opts: { value: string }) => Promise<boolean>;
}

// A hook is never handed an async function, so the copy lives outside it; it holds no state, which is
// why the hook returns the same function on every render, as `useCallback(..., [])` did.
const copyToClipboard = async (opts: { value: string }): Promise<boolean> => {
  const isCopied = await BrowserClipboard.writeText({ text: opts.value });
  if (!isCopied) {
    logger.warn('[copy] The clipboard did not take the text');
  }

  return isCopied;
};

export const useCopyToClipboard = (): IUseCopyToClipboardReturn => ({ copy: copyToClipboard });
