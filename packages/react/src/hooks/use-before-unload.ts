import React from 'react';

export interface IUseBeforeUnloadOptions {
  /** @default true */
  enabled?: boolean;
  message?: string;
}

export const useBeforeUnload = (opts: IUseBeforeUnloadOptions) => {
  const { enabled = true, message } = opts;

  const handleBeforeUnload = React.useCallback(
    (event: BeforeUnloadEvent) => {
      if (!enabled) {
        return;
      }

      event.preventDefault();

      if (message) {
        event.returnValue = message;
      }

      return message;
    },
    [enabled, message],
  );

  React.useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);
};
