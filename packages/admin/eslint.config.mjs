import { eslintConfigs } from '@venizia/dev-configs';

const config = [
  ...eslintConfigs,
  {
    // react-admin reads its messages by wire key (`ra.action.add_filter`, `ra.page.not_found`, ...).
    // These bundles are the mapper boundary to that vocabulary, not ARDOR identifiers, so they must
    // spell the keys exactly as ra-core looks them up.
    files: ['src/common/locales/**/*.ts'],
    rules: { '@typescript-eslint/naming-convention': 'off' },
  },
];

export default config;
