import { Logger } from '@venizia/ardor-kernel';

const logger = Logger.getInstance({ scope: 'useCopyToClipboard' });

export interface IUseCopyToClipboardReturn {
  copy: (opts: { value: string }) => Promise<boolean>;
}

// A hook is never handed an async function, so the copy lives outside it; it holds no state, which is
// why the hook returns the same function on every render, as `useCallback(..., [])` did.
const copyToClipboard = async (opts: { value: string }): Promise<boolean> => {
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
};

export const useCopyToClipboard = (): IUseCopyToClipboardReturn => ({ copy: copyToClipboard });
