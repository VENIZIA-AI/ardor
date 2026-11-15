import { Ardor } from '@venizia/ardor';
import { LinkBase, useLocaleState, useLogout } from 'ra-core';
import type { ReactNode } from 'react';

import { Locales } from '@/constants/shell';

export const ShellLayout = (props: { children?: ReactNode }) => {
  const entries = Ardor.useMenuEntries();
  const roles = Ardor.useRoles();
  const translate = Ardor.useTranslate();
  const translateLabel = Ardor.useUntypedTranslate();
  const [locale, setLocale] = useLocaleState();
  const logout = useLogout();
  const nextLocale = locale === Locales.ENGLISH ? Locales.VIETNAMESE : Locales.ENGLISH;

  return (
    <div>
      <header>
        <span data-testid="roles">
          {translate('shell.roles')}: {[...roles].join(', ')}
        </span>{' '}
        <button type="button" onClick={() => setLocale(nextLocale)}>
          {translate('shell.language')}
        </button>{' '}
        <button type="button" onClick={() => logout()}>
          {translate('shell.signOut')}
        </button>
      </header>
      <nav>
        <ul data-testid="menu">
          {entries.map((entry) => (
            <li key={entry.to}>
              <LinkBase to={entry.to}>{translateLabel(entry.label)}</LinkBase>
            </li>
          ))}
        </ul>
      </nav>
      {props.children}
    </div>
  );
};
