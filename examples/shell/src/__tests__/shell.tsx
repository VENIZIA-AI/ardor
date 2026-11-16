import { ArdorApplication, CoreBindings, type DefaultAuthService } from '@venizia/ardor';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { Application } from '@/application';
import { ShellLayout } from '@/components/shell-layout';
import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';

/** A started application; with `roles`, a user is signed in with them, as a sign-in would store it. */
export const startShell = async (opts: { roles?: Array<string> } = {}) => {
  const application = new Application();
  await application.start();

  if (opts.roles) {
    application
      .get<DefaultAuthService>({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
      .saveAuth({ userId: 1, token: { value: 'test-token', type: 'Bearer' }, roles: opts.roles });
  }

  return application;
};

/**
 * Makes every request of the test reject, so a page that fetches fails loudly; returns the undo. With
 * `isPending`, a request never settles instead: for a page that react-admin fetches for a user it then sends
 * elsewhere (a denied show page), where an answer that came back at once would redirect to the list first.
 */
export const blockNetwork = (opts: { isPending?: boolean } = {}): (() => void) => {
  const original = globalThis.fetch;
  globalThis.fetch = Object.assign(
    () =>
      opts.isPending
        ? new Promise<Response>(() => {})
        : Promise.reject(new TypeError('No network in tests')),
    { preconnect: original.preconnect },
  );

  return () => {
    globalThis.fetch = original;
  };
};

/** The shell as main.tsx mounts it, under a memory router: react-admin's own router needs a real browser. */
export const renderShell = (opts: { application: Application; path: string }): void => {
  render(
    <MemoryRouter initialEntries={[opts.path]}>
      <ArdorApplication
        container={opts.application}
        suspense={<p>Loading</p>}
        loginPage={LoginPage}
        layout={ShellLayout}
        dashboard={HomePage}
      />
    </MemoryRouter>,
  );
};
