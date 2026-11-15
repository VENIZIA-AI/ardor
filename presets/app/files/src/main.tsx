import 'reflect-metadata';

import { ArdorApplication } from '@venizia/ardor';
import { createRoot } from 'react-dom/client';

import { Application } from '#src/application';
import { Home } from '#src/pages/home';

import './themes/index.css';

const application = new Application();

await application.start();

createRoot(document.getElementById('root')!).render(
  <ArdorApplication container={application} suspense={<p>Loading</p>} dashboard={Home} />,
);
