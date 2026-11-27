import {
  houseConfigs,
  NoAwaitNewChainRule,
  NoAwaitPromiseChainRule,
  NoInlineAwaitRule,
  NoReturnAwaitRule,
  NoSilentCatchRule,
  paddingConfigs,
  PreferPromiseSleepRule,
} from '@venizia/dev-configs/linters';

// The release and check scripts run on Bun, some before any install, and throw plain errors: of the house
// rules only the async style, the sleep rule and the cast rule apply to them, with the blank-line padding.
const HOUSE_RULES = new Set([
  NoAwaitNewChainRule.NAME,
  NoAwaitPromiseChainRule.NAME,
  NoInlineAwaitRule.NAME,
  NoReturnAwaitRule.NAME,
  NoSilentCatchRule.NAME,
  PreferPromiseSleepRule.NAME,
]);

export default [
  ...houseConfigs.map((config) => {
    if (!config.rules) {
      return config;
    }

    return {
      ...config,
      rules: Object.fromEntries(
        Object.entries(config.rules).filter(([name]) => HOUSE_RULES.has(name)),
      ),
    };
  }),
  ...paddingConfigs,
  // `scripts/build/` holds sources: the preset's ignore of build output folders does not apply to it.
  { ignores: ['!scripts/build', '!scripts/build/**'] },
  // V-C-10: no cast. A test stubs what it does not build, so it is exempt, as in the house rules.
  {
    files: ['**/*.{ts,mts}'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,mts}'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
];
