import React from 'react';

import { useLocaleState } from 'ra-core';

/**
 * Keeps `<html lang>` on the UI locale - screen readers pick their voice from it.
 *
 * @useWhen `<html lang>` must follow the UI locale
 * @insteadOf setting `document.documentElement.lang` in an effect
 */
export const useHtmlLang = () => {
  const [locale] = useLocaleState();

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
};
