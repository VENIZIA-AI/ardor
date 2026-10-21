import 'reflect-metadata';

import { configureStore } from '@reduxjs/toolkit';
import { ArdorApplication } from '@venizia/ardor';
import { createRoot } from 'react-dom/client';

import { Application } from '#src/application';
import { Home } from '#src/pages/home';

import './themes/index.css';

const application = new Application();
const store = configureStore({
  reducer: { app: (state: { ready: boolean } = { ready: true }) => state },
});

await application.start();

createRoot(document.getElementById('root')!).render(
  <ArdorApplication
    container={application}
    reduxStore={store}
    suspense={<p>Loading</p>}
    dashboard={Home}
  />,
);
