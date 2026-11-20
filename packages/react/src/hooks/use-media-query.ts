import React from 'react';

import { MediaQueryStore } from './media-query-store';

/** Whether the media query matches now, and again after each change. `false` in a server render. */
export const useMediaQuery = (opts: { query: string }): boolean => {
  const { query } = opts;
  const subscribe = React.useMemo(() => {
    return (listener: () => void) => MediaQueryStore.subscribe({ queries: [query], listener });
  }, [query]);

  return React.useSyncExternalStore(
    subscribe,
    () => MediaQueryStore.matches({ query }),
    () => false,
  );
};
