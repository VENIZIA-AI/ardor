import { defineConfig } from 'oxlint';
import { BrowserOxlintConfigs } from '@venizia/dev-configs/linters/oxlint';

const base = BrowserOxlintConfigs.create();

// A command line prints to the terminal: that output is what the user runs it for.
export default defineConfig({
  ...base,
  overrides: [
    ...(base.overrides ?? []),
    {
      files: ['**/src/codemod/ardor-cli.ts', '**/src/codemod/command.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
});
