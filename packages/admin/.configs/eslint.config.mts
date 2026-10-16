import { reactNamingConventionConfigs } from '@venizia/dev-configs/linters';

// oxlint runs every other rule; ESLint keeps the one oxlint has no port of yet.
export default [
  ...reactNamingConventionConfigs,
  {
    // react-admin reads its messages by wire key (`ra.action.add_filter`, `ra.page.not_found`, ...).
    // These bundles are the mapper boundary to that vocabulary, not ARDOR identifiers, so they must
    // spell the keys exactly as ra-core looks them up.
    files: ['src/common/locales/**/*.ts'],
    rules: { '@typescript-eslint/naming-convention': 'off' },
  },
];
