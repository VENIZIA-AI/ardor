import { ArdorApplication, CoreBindings, type DefaultAuthService } from '@venizia/ardor';
import { act, render } from '@testing-library/react';
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

/** Makes every request of the test reject, so a page that fetches fails loudly; returns the undo. */
export const blockNetwork = (): (() => void) => {
  const original = globalThis.fetch;
  globalThis.fetch = Object.assign(() => Promise.reject(new TypeError('No network in tests')), {
    preconnect: original.preconnect,
  });

  return () => {
    globalThis.fetch = original;
  };
};

/**
 * The shell as main.tsx mounts it, under a memory router: react-admin's own router needs a real browser.
 * It resolves once the updates react-admin makes right after the first render have run.
 */
export const renderShell = async (opts: { application: Application; path: string }) => {
  await act(async () => {
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
  });
};
