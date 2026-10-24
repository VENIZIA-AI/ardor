import React from 'react';

export interface IUseConfirmReturn {
  message?: string;
  confirm: (opts: { message: string }) => Promise<boolean>;
  handleClose: () => void;
  handleConfirm: () => void;
  handleAbort: () => void;
}

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
