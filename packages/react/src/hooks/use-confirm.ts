import React from 'react';

export interface IUseConfirmReturn {
  /** The pending prompt text; `undefined` when none is open. */
  message?: string;
  /** Opens a prompt. Resolves `true` on `handleConfirm`, `false` on `handleAbort` or when another `confirm` replaces it. */
  confirm: (opts: { message: string }) => Promise<boolean>;
  /** Closes the prompt without settling it. */
  handleClose: () => void;
  /** Resolves the pending `confirm` with `true` and closes. */
  handleConfirm: () => void;
  /** Resolves the pending `confirm` with `false` and closes. */
  handleAbort: () => void;
}

/** State for a confirmation prompt: `confirm` returns a promise that the prompt's buttons settle. */
export const useConfirm = (): IUseConfirmReturn => {
  const settle = React.useRef<((isConfirmed: boolean) => void) | undefined>(undefined);

  const [message, setMessage] = React.useState<string>();

  const confirm = React.useCallback((opts: { message: string }) => {
    // A prompt that is replaced was not confirmed: settle it, or its caller waits forever.
    settle.current?.(false);

    return new Promise<boolean>((resolve) => {
      settle.current = resolve;
      setMessage(opts.message);
    });
  }, []);

  const handleClose = React.useCallback(() => {
    settle.current = undefined;
    setMessage(undefined);
  }, []);

  const handleConfirm = React.useCallback(() => {
    settle.current?.(true);
    handleClose();
  }, [handleClose]);

  const handleAbort = React.useCallback(() => {
    settle.current?.(false);
    handleClose();
  }, [handleClose]);

  return { message, confirm, handleClose, handleConfirm, handleAbort };
};
