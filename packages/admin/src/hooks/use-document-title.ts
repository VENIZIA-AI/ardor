import React from 'react';

type TDocumentTitleSegment = string | false | null | undefined;

export interface IUseDocumentTitleOptions {
  title: TDocumentTitleSegment | Array<TDocumentTitleSegment>;
  appTitle: string;
  separator?: string;
  enabled?: boolean;
  /**
   * A base title for a layout. It shows only while no other call is mounted, so a screen's title
   * wins on the first mount although the layout's effect runs after the screen's. Of two fallbacks,
   * the one mounted last shows. @default false
   */
  fallback?: boolean;
}

interface ITitleEntry {
  title: string;
  isFallback: boolean;
}

// The calls mounted now, in the order they registered, with the tab title before the first one and
// the title this module wrote last: the last is how a later writer outside the hook is recognised.
const entries: Array<ITitleEntry> = [];
let originalTitle: string | undefined;
let writtenTitle: string | undefined;

/** The last screen title mounted; with none, the last fallback. */
const resolveTitle = (): string | undefined => {
  let fallback: string | undefined;

  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];

    if (!entry.isFallback) {
      return entry.title;
    }
    fallback ??= entry.title;
  }

  return fallback;
};

const writeTitle = () => {
  writtenTitle = resolveTitle();

  if (writtenTitle !== undefined) {
    document.title = writtenTitle;
  }
};

const register = (entry: ITitleEntry) => {
  if (entries.length === 0) {
    originalTitle = document.title;
  }

  entries.push(entry);
  writeTitle();
};

const unregister = (entry: ITitleEntry) => {
  entries.splice(entries.indexOf(entry), 1);

  if (entries.length > 0) {
    writeTitle();
    return;
  }

  // Restore only our own write: a later writer (a layout re-mounted for a new locale, or a twin
  // call React cleans up first) owns the title now.
  if (originalTitle !== undefined && document.title === writtenTitle) {
    document.title = originalTitle;
  }
  originalTitle = undefined;
  writtenTitle = undefined;
};

/**
 * Sets the tab title to the screen title before `appTitle` (`Orders · Back Office`). On unmount it
 * puts back the title it replaced - unless someone wrote a newer one since - so one call per screen
 * is enough, with no reset on navigation. A layout passes `fallback: true` for a base title the
 * screens override.
 */
export const useDocumentTitle = (opts: IUseDocumentTitleOptions) => {
  const { title, appTitle, separator = ' · ', enabled = true, fallback = false } = opts;

  const segments = Array.isArray(title) ? title : [title];
  const documentTitle = [...segments, appTitle].filter(Boolean).join(separator);

  React.useEffect(() => {
    if (!enabled) {
      return () => {};
    }

    const entry: ITitleEntry = { title: documentTitle, isFallback: fallback };
    register(entry);

    return () => {
      unregister(entry);
    };
  }, [enabled, documentTitle, fallback]);
};
