import type { IPurityClaim } from '@venizia/dev-configs/checks';

// The data of the browser-purity gate: which entries are claimed pure, and what each leaves external.
// The engine is `devz check purity --claims scripts/checks/purity/manifest.ts` ('@venizia/dev-configs'):
// it derives the rows from each package's `exports` map, so a sub-path added later is claimed by default.

/** What the umbrella's browser entries leave external: the peers of ARDOR's UI layers. */
const ARDOR_EXTERNAL = [
  'react',
  'react-dom',
  'react-redux',
  '@reduxjs/toolkit',
  'ra-core',
  'ra-i18n-polyglot',
  '@tanstack/react-query',
  'react-router-dom',
];

export const PURITY_CLAIMS: IPurityClaim[] = [
  // Every ARDOR runtime package is a browser library, so every entry is claimed pure. `external`
  // lists the package's THIRD-PARTY peers and packaging: the React ecosystem reads
  // `process.env.NODE_ENV` verbatim and relies on the consumer's bundler to define it.
  // ARDOR's own code and every `@venizia/*` dependency stay in the measured graph. The layering rule
  // (no ra-core outside admin, no React in the kernel) is scripts/checks/layer-boundaries.ts.
  {
    package: 'kernel',
    external: {
      '.': [],
    },
  },
  { package: 'react', external: { '.': ['react', 'react-redux', '@reduxjs/toolkit'] } },
  {
    package: 'admin',
    external: {
      '.': [
        'react',
        'react-dom',
        'react-redux',
        '@reduxjs/toolkit',
        'ra-core',
        'ra-i18n-polyglot',
        '@tanstack/react-query',
        'react-router-dom',
      ],
    },
  },
  {
    package: 'ardor',
    // `./vite` runs in Node, under the build of an app: it is no browser entry. `./testing` is
    // claimed: a boot test runs under a DOM and must not pull a Node builtin into the app's graph.
    subpaths: ['.', './repository', './testing'],
    external: {
      '.': ARDOR_EXTERNAL,
      './testing': ARDOR_EXTERNAL,
    },
  },
];
