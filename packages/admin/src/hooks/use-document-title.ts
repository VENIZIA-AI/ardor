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
 * puts back the title it replaced, so one call per screen is enough - no reset on navigation.
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
      document.title = previousTitle;
    };
  }, [enabled, documentTitle]);
};
