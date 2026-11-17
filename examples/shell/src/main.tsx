import 'reflect-metadata';

import { ArdorApplication } from '@venizia/ardor';
import { getError } from '@venizia/ignis-inversion';
import { createRoot } from 'react-dom/client';

import { Application } from '@/application';
import { ShellLayout } from '@/components/shell-layout';
import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';

const application = new Application();
await application.start();

const root = document.getElementById('root');

if (!root) {
  throw getError({ message: '[main] The page has no #root element' });
}

createRoot(root).render(
  <ArdorApplication
    container={application}
    suspense={<p>Loading</p>}
    loginPage={LoginPage}
    layout={ShellLayout}
    dashboard={HomePage}
  />,
);
