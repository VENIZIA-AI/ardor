import React from 'react';

const subscribe = (listener: () => void) => {
  document.addEventListener('visibilitychange', listener);

  return () => document.removeEventListener('visibilitychange', listener);
};

/**
 * `'visible'` or `'hidden'`, as the document says. `'visible'` in a server render.
 *
 * @useWhen a component must pause or refresh when the tab is hidden or shown
 * @insteadOf `document.visibilityState` with a `visibilitychange` listener
 */
export const useDocumentVisibility = (): DocumentVisibilityState => {
  return React.useSyncExternalStore(
    subscribe,
    () => document.visibilityState,
    () => 'visible',
  );
};
