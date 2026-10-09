import React from 'react';

type TDocumentTitleSegment = string | false | null | undefined;

export interface IUseDocumentTitleOptions {
  title: TDocumentTitleSegment | Array<TDocumentTitleSegment>;
  appTitle: string;
  separator?: string;
  enabled?: boolean;
}

/**
 * Sets the tab title to the screen title before `appTitle` (`Orders · Back Office`). On unmount it
 * puts back the title it replaced - unless someone wrote a newer one since - so one call per screen
 * is enough, with no reset on navigation.
 */
export const useDocumentTitle = (opts: IUseDocumentTitleOptions) => {
  const { title, appTitle, separator = ' · ', enabled = true } = opts;

  const segments = Array.isArray(title) ? title : [title];
  const documentTitle = [...segments, appTitle].filter(Boolean).join(separator);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const previousTitle = document.title;
    document.title = documentTitle;

    return () => {
      // Restore only our own write: a later writer (a layout re-mounted for a new locale, or a twin
      // call React cleans up first) owns the title now.
      if (document.title === documentTitle) {
        document.title = previousTitle;
      }
    };
  }, [enabled, documentTitle]);
};
