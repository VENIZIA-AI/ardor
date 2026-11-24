import React from 'react';

const subscribe = (listener: () => void) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);

  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
};

/**
 * Whether the browser is online, kept by the `online` and `offline` events. `true` in a server render.
 *
 * @useWhen the UI must show or react to the browser going offline
 * @insteadOf `navigator.onLine` with `online` and `offline` listeners
 */
export const useOnlineStatus = (): boolean => {
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
};
