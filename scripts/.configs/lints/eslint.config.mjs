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
// rules only the async style and the sleep rule apply to them, with the blank-line padding.
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
];
