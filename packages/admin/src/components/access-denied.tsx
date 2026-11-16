import React from 'react';

import { LinkBase, useBasename } from 'ra-core';

import { useTranslate } from '@/hooks/use-translate';

/**
 * The page `ArdorApplication` mounts at `/access-denied` unless the application passes its own
 * `accessDenied`: a title, a sentence and a link home, translated with the `ardor.access_denied`
 * keys. Unstyled, for a shell to replace.
 */
export const AccessDeniedPage: React.FC = () => {
  const translate = useTranslate();
  const basename = useBasename();
  const titleId = React.useId();

  return (
    <section aria-labelledby={titleId}>
      <h1 id={titleId}>{translate('ardor.access_denied.title')}</h1>
      <p>{translate('ardor.access_denied.message')}</p>
      <LinkBase to={`${basename}/`}>{translate('ardor.access_denied.home')}</LinkBase>
    </section>
  );
};
