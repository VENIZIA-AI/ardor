import {
  ConstClassValuesRule,
  NamingConventionRule,
  reactHouseConfigs,
} from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs what oxlint cannot: the naming convention, the house rules,
// `no-leaked-render` and the async style (`no-inline-await`, `no-return-await`, and for hooks
// `no-async-hook-callback` and `effect-cleanup-consistency`).
export default [
  ...reactHouseConfigs,
  {
    // ra-core names the keys of its messages (`ra.action.add_filter`, `ra.page.not_found`, ...), so a
    // locale bundle spells them in snake_case. Every other name in these files follows the house rule.
    files: ['src/common/locales/**/*.ts'],
    rules: {
      [NamingConventionRule.NAME]: NamingConventionRule.build({
        extraSelectors: [
          {
            selector: 'objectLiteralProperty',
            filter: { regex: '^[a-z0-9]+(_[a-z0-9]+)+$', match: true },
            format: ['snake_case'],
          },
        ],
      }),
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      [ConstClassValuesRule.NAME]: ConstClassValuesRule.build(),
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
];
