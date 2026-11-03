import { asyncStyleConfigs, houseConfigs } from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs what oxlint cannot: the naming convention, the house rules and
// the async style (`no-inline-await`, `no-return-await`).
export default [...houseConfigs, ...asyncStyleConfigs];
