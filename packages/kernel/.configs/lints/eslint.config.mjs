import {
  houseConfigs,
  NoShadowFrameworkTypeRule,
  PublishedPackageConfigs,
} from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs what oxlint cannot: the naming convention, the house rules and
// the async style (`no-inline-await`, `no-return-await`).
export default [
  ...houseConfigs,
  ...PublishedPackageConfigs.build(),
  {
    // The browser kernel's own types: same names as IGNIS's server types, different shapes
    // (string | number ids, an optional-field identity, an application info with an id, an artifact index of plain classes).
    files: ['src/common/types.ts'],
    rules: {
      'venizia/no-shadow-framework-type': NoShadowFrameworkTypeRule.build({
        allow: ['IdType', 'IAuthUser', 'IArtifactIndex', 'IApplicationInfo'],
      }),
    },
  },
];
