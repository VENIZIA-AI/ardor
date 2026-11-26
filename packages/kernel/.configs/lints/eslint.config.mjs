import { houseConfigs, NoShadowFrameworkTypeRule } from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs what oxlint cannot: the naming convention, the house rules and
// the async style (`no-inline-await`, `no-return-await`).
export default [
  ...houseConfigs,
  {
    // `IdType` is IGNIS's without `bigint`, which `JSON.stringify` and react-admin refuse.
    files: ['src/common/types.ts'],
    rules: {
      'venizia/no-shadow-framework-type': NoShadowFrameworkTypeRule.build({
        allow: ['IdType'],
      }),
    },
  },
];
