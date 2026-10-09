import React from 'react';

import { useLocaleState } from 'ra-core';

/** Keeps `<html lang>` on the UI locale - screen readers pick their voice from it. */
export const useHtmlLang = () => {
  const [locale] = useLocaleState();

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
};
