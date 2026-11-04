import React from 'react';

const SERVER_SNAPSHOT = () => false;

/** Whether the media query matches now, and again after each change. `false` in a server render. */
export const useMediaQuery = (opts: { query: string }): boolean => {
  const { query } = opts;
  const subscribe = React.useMemo(() => {
    return (listener: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);

      return () => list.removeEventListener('change', listener);
    };
  }, [query]);

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    SERVER_SNAPSHOT,
  );
};
