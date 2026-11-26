import { defineConfig } from 'oxlint';
import { ReactOxlintConfigs } from '@venizia/dev-configs/linters/oxlint';

const base = ReactOxlintConfigs.create();

// Overloads with a TSDoc of their own are separate on purpose: each one types a call that a union
// parameter would let through. Goes when the preset of `@venizia/dev-configs` sets the option.
export default defineConfig({
  ...base,
  rules: {
    ...base.rules,
    'typescript/unified-signatures': ['error', { ignoreOverloadsWithDifferentJSDoc: true }],
  },
});
