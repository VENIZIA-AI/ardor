import { defineConfig } from 'oxlint';
import { NoRestrictedPropertiesRule, oxlintConfigs } from '@venizia/dev-configs/linters';

// The base preset plus the secure-context rule: this code runs in a browser, where a plain-http origin
// has no crypto.randomUUID.
export default defineConfig({
  ...oxlintConfigs,
  rules: {
    ...oxlintConfigs.rules,
    [NoRestrictedPropertiesRule.NAME]: NoRestrictedPropertiesRule.build(),
  },
});
