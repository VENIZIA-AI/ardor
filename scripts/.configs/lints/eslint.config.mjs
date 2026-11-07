import {
  houseConfigs,
  NoAwaitNewChainRule,
  NoAwaitPromiseChainRule,
  NoInlineAwaitRule,
  NoReturnAwaitRule,
  NoSilentCatchRule,
} from '@venizia/dev-configs/linters';

// The release and check scripts run on Bun and throw plain errors, so only the async style applies to them.
const ASYNC_RULES = new Set([
  NoAwaitNewChainRule.NAME,
  NoAwaitPromiseChainRule.NAME,
  NoInlineAwaitRule.NAME,
  NoReturnAwaitRule.NAME,
  NoSilentCatchRule.NAME,
]);

export default houseConfigs.map((config) => {
  if (!config.rules) {
    return config;
  }

  return {
    ...config,
    rules: Object.fromEntries(
      Object.entries(config.rules).filter(([name]) => ASYNC_RULES.has(name)),
    ),
  };
});
