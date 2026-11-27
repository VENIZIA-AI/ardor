import { defineConfig } from 'oxlint';
import { oxlintConfigs } from '@venizia/dev-configs/linters/oxlint';

const base = oxlintConfigs;

// The build scripts of the wiki print on purpose. SearchBox.vue and useTerminal.ts run in a browser and
// log a failure there; they are shared copies, so only a change in VULCAN can replace that call.
export default defineConfig({
  ...base,
  overrides: [
    ...(base.overrides ?? []),
    {
      files: [
        '**/scripts/**',
        '**/site/.vitepress/theme/shared/{build-check,search-index,useTerminal}.ts',
        '**/site/.vitepress/theme/shared/SearchBox.vue',
      ],
      rules: { 'no-console': 'off' },
    },
  ],
});
