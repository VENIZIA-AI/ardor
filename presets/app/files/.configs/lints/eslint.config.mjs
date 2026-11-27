import { PreferFrameworkApiRule, reactHouseConfigs } from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs what oxlint cannot: the naming convention, the house rules
// and `no-leaked-render`.
export default [
  ...reactHouseConfigs,
  {
    // The dev server's proxy falls back to the backend on this machine; no browser reads these files.
    files: ['.configs/builders/**'],
    rules: {
      [PreferFrameworkApiRule.NAME]: PreferFrameworkApiRule.build({
        hooks: true,
        ignore: ['localhost-url'],
      }),
    },
  },
];
