import { defineConfig } from 'oxlint';
import { oxlintConfigs } from '@venizia/dev-configs/linters/oxlint';

const base = oxlintConfigs;

// The build scripts of the wiki and its terminal print to the console on purpose.
export default defineConfig({
  ...base,
  overrides: [
    ...(base.overrides ?? []),
    { files: ['**/scripts/**', '**/site/.vitepress/theme/**'], rules: { 'no-console': 'off' } },
  ],
});
