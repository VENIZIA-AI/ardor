import { defineConfig } from 'oxlint';
import { oxlintConfigs } from '@venizia/dev-configs/linters/oxlint';

const base = oxlintConfigs;

// The build scripts of the wiki print on purpose.
export default defineConfig({
  ...base,
  overrides: [
    ...(base.overrides ?? []),
    {
      files: ['**/scripts/**', '**/site/.vitepress/theme/shared/{build-check,search-index}.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
});
