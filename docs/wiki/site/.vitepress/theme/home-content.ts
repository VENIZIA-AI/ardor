/**
 * Every word of ARDOR's home page and footer. The structure, the design and the behaviour are the
 * shared layout (theme/shared); this file only says what it shows.
 *
 * COUNTS is what the page claims about the repository. A test of the repository
 * (scripts/checks/__tests__/wiki-intro-counts.test.ts) counts the same things and fails when a
 * number here drifts, so update COUNTS and the test passes again.
 */
import pkg from '../../../../../packages/ardor/package.json';
import type { THomeContent, TSiteInfo } from './shared/home-types';

export const COUNTS = { packages: 4, examples: 3, testFiles: 53, nodeBuiltins: 0 };

export const VERSION: string = pkg.version;

const BUN_FLOOR = `${pkg.engines.bun.replace('>=', '')}+`;

export const SITE: TSiteInfo = {
  id: 'ardor',
  name: 'ARDOR',
  repo: 'https://github.com/VENIZIA-AI/ardor',
  npm: 'https://www.npmjs.com/package/@venizia/ardor',
  own: [
    ['Guide', '/guides/'],
    ['References', '/references/'],
    ['Create a project', '/guides/get-started/create-a-project'],
    ['Changelog', '/changelogs/'],
  ],
};

export const HOME: THomeContent = {
  id: 'ardor',
  name: 'ARDOR',
  version: VERSION,
  eyebrow: `ARDOR ${VERSION} · MIT · Bun ${BUN_FLOOR} · React`,
  // A no-break space joins the last two words, so the coloured line never leaves "surface." alone.
  title: [['Shape your admin panels.'], 'ARDOR tempers the surface.'],
  // The sentence of the meta, og and twitter descriptions in config.mts (a test keeps them equal).
  lede: 'Admin consoles on react-admin, with the same dependency injection and filter language as IGNIS, plus sign-in and i18n.',
  install: {
    label: 'Create an admin',
    lines: [
      'bun x @venizia/vulcan init --preset ardor --project demo --frontend-dir apps --app admin',
      'cd demo && make dev',
    ],
  },
  cta: [
    ['Create a project', '/guides/get-started/create-a-project'],
    ['References', '/references/'],
  ],
  tabs: [
    {
      file: 'src/configurations/admin.configuration.ts',
      kind: 'code',
      body: `import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultRestDataProvider,
  getRuntimeConfig,
  inject,
  provide,
} from '@venizia/ardor';

@configuration()
export class AdminConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    const url = getRuntimeConfig({
      key: 'VITE_API_URL',
      buildTimeEnv: import.meta.env,
      defaultValue: '/api',
    });

    return { url, noAuthPathRegex: /./ };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }
}`,
      note: 'The configuration the preset writes into a new admin, with the i18n bindings left out. <a href="/guides/core-concepts/configuration">Configuration</a>',
    },
    {
      file: 'src/main.tsx',
      kind: 'code',
      body: `import 'reflect-metadata';

import { configureStore } from '@reduxjs/toolkit';
import { ArdorApplication } from '@venizia/ardor';
import { createRoot } from 'react-dom/client';

import { Application } from '#src/application';
import { Home } from '#src/pages/home';

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
);`,
      note: 'The mount point of the same preset, without its stylesheet import. <a href="/guides/core-concepts/application">Application</a>',
    },
    {
      file: 'terminal',
      kind: 'term',
      body: [
        [
          'cmd',
          'bun x @venizia/vulcan init --preset ardor --project demo --frontend-dir apps --app admin',
        ],
        ['cmd', 'cd demo && make dev'],
        ['verdict', 'the admin is on http://localhost:5173/'],
      ],
      note: 'The commands of <a href="/guides/get-started/create-a-project">Create a project</a>.',
    },
  ],
  stats: [
    [String(COUNTS.packages), 'packages'],
    [String(COUNTS.examples), 'examples'],
    [String(COUNTS.testFiles), 'test files'],
    [String(COUNTS.nodeBuiltins), 'Node builtins in the browser packages'],
  ],
  footnote: `Counted from the repository (${VERSION}): the packages and examples folders, every *.test.ts and *.test.tsx file in them, and the imports of Node builtins in the kernel, react and admin sources. A test fails when a number drifts.`,
  featuresTitle: 'What is in the box',
  featuresLede: 'Each part has a page that says what it does and what it does not.',
  cells: [
    {
      name: 'di',
      title: 'Dependency injection in the browser',
      text: 'The application extends the IGNIS container. Bindings, @inject and useInjectable by key or class.',
      href: '/guides/core-concepts/dependency-injection',
    },
    {
      name: 'data',
      title: 'REST data provider',
      text: 'Maps the react-admin calls to the IGNIS filter vocabulary and takes the total from the Content-Range header.',
      href: '/references/data-provider',
    },
    {
      name: 'auth',
      title: 'Auth with recovery',
      text: 'A 401 triggers one shared token refresh and one retry per request. No-auth paths are explicit.',
      href: '/best-practices/auth-recovery',
    },
    {
      name: 'i18n',
      title: 'i18n with typed keys',
      text: 'English and Vietnamese bundles, and useTranslate keys typed through module augmentation.',
      href: '/references/i18n',
    },
    {
      name: 'repository',
      title: 'HTTP repository',
      text: "HttpDataSource and HttpRepository from IGNIS, able to share the data provider's token and refresh.",
      href: '/references/repository',
    },
    {
      name: 'hooks',
      title: 'Hooks and Redux factories',
      text: 'useDebounce, useAutosave, useConfirm, useCopyToClipboard and typed selector and dispatch factories.',
      href: '/references/hooks',
    },
    {
      name: 'features',
      title: 'Features and runtime config',
      text: 'Features.define packages configurations, resources, routes and messages. getRuntimeConfig lets one image serve every environment.',
      href: '/references/features',
    },
    {
      name: 'more',
      title: 'Everything else',
      text: 'Every public API has a reference page: application, binding keys, network, permission and types.',
      href: '/references/',
    },
  ],
  fitUse: [
    'An enterprise admin panel that needs a clean IoC architecture',
    'An application that pairs react-admin with an IGNIS backend',
    'A team that wants DI in React through useInjectable',
    'A typed REST data provider, token refresh and i18n',
  ],
  fitNot: [
    'A lightweight landing page with no admin state',
    'An application that is not built on React',
    'An app with no service orchestration or DI requirement',
    'A project that needs a 1.0 API: ARDOR is 0.x and a patch release can carry a breaking change',
  ],
  maturityHtml:
    '<b>ARDOR is 0.x: a patch release can carry a breaking change.</b> Pin exact versions and read the <a href="/changelogs/">changelog</a> before upgrading. It ships no socket client: use the IGNIS one.',
  builtOn: ['ra-core', 'IGNIS', 'React', 'TypeScript', 'VULCAN'],
  closing: {
    title: 'Create an admin in one command.',
    text: 'The preset writes the application, the data provider configuration and the mount point.',
  },
};
