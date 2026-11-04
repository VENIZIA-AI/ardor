import React from 'react';

import { LoggerFactory } from '@venizia/ignis-helpers/core';

import { BrowserClipboard } from '@venizia/ardor-kernel';

const logger = LoggerFactory.getLogger(['useCopyToClipboard']);

export interface IUseCopyToClipboardOptions {
  /** Set `isCopied` back to `false` this many milliseconds after a copy; 0 or less never resets. @default 0 */
  resetMs?: number;
}

export interface IUseCopyToClipboardReturn {
  /** Resolves `true` when the text is on the clipboard and `false` otherwise, and never throws. */
  copy: (opts: { value: string }) => Promise<boolean>;
  /** The result of the last copy, until `resetMs` has passed. */
  isCopied: boolean;
}

// A hook is never handed an async function, so the copy lives outside it.
const copyToClipboard = async (opts: { value: string }): Promise<boolean> => {
  const isCopied = await BrowserClipboard.writeText({ text: opts.value });
  if (!isCopied) {
    logger.warn('[copy] The clipboard did not take the text');
  }

  return isCopied;
};

export const useCopyToClipboard = (
  opts: IUseCopyToClipboardOptions = {},
): IUseCopyToClipboardReturn => {
  const { resetMs = 0 } = opts;
  const [isCopied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const copy = React.useCallback(
    (copyOpts: { value: string }) => {
      return copyToClipboard(copyOpts).then((isDone) => {
        clearTimeout(timerRef.current);
        setCopied(isDone);
        if (isDone && resetMs > 0) {
          timerRef.current = setTimeout(() => setCopied(false), resetMs);
        }

        return isDone;
      });
    },
    [resetMs],
  );

  return { copy, isCopied };
};
