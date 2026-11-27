import { defineConfig } from 'oxlint';
import { BrowserOxlintConfigs } from '@venizia/dev-configs/linters/oxlint';

const base = BrowserOxlintConfigs.create();

// The stub API is a local server that prints the address it listens on.
export default defineConfig({
  ...base,
  overrides: [
    ...(base.overrides ?? []),
    { files: ['**/api/server.ts'], rules: { 'no-console': 'off' } },
  ],
});
