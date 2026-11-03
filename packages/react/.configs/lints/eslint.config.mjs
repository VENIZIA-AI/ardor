import {
  asyncStyleConfigs,
  reactAsyncStyleConfigs,
  reactHouseConfigs,
} from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs what oxlint cannot: the naming convention, the house rules,
// `no-leaked-render` and the async style (`no-inline-await`, `no-return-await`, and for hooks
// `no-async-hook-callback` and `effect-cleanup-consistency`).
export default [...reactHouseConfigs, ...asyncStyleConfigs, ...reactAsyncStyleConfigs];
