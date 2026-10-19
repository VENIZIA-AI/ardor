import { reactHouseConfigs } from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs what oxlint cannot: the naming convention, the house rules
// and `no-leaked-render`.
export default [
  ...reactHouseConfigs,
  {
    // react-admin reads its messages by wire key (`ra.action.add_filter`, `ra.page.not_found`, ...).
    // These bundles are the mapper boundary to that vocabulary, not ARDOR identifiers, so they must
    // spell the keys exactly as ra-core looks them up.
    files: ['src/common/locales/**/*.ts'],
    rules: { '@typescript-eslint/naming-convention': 'off' },
  },
];
