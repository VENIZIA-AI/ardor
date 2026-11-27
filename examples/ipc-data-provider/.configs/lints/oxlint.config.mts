import { defineConfig } from 'oxlint';
import { BrowserOxlintConfigs } from '@venizia/dev-configs/linters/oxlint';

const base = BrowserOxlintConfigs.create();

// The example is a script whose output is what it shows.
export default defineConfig({
  ...base,
  overrides: [
    ...(base.overrides ?? []),
    { files: ['**/src/index.ts'], rules: { 'no-console': 'off' } },
  ],
});
