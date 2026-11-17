import React from 'react';

const subscribe = (listener: () => void) => {
  document.addEventListener('visibilitychange', listener);

  return () => document.removeEventListener('visibilitychange', listener);
};

/** `'visible'` or `'hidden'`, as the document says. `'visible'` in a server render. */
export const useDocumentVisibility = (): DocumentVisibilityState => {
  return React.useSyncExternalStore(
    subscribe,
    () => document.visibilityState,
    () => 'visible',
  );
};
