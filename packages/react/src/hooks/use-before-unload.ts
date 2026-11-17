import React from 'react';

/** When `useBeforeUnload` asks, and the text it sets. */
export interface IUseBeforeUnloadOptions {
  /** @default true */
  enabled?: boolean;
  /** Set as the `returnValue` of the event; browsers may show their own text instead. */
  message?: string;
}

/** While `enabled`, asks the browser to confirm before the page is left or reloaded. */
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
