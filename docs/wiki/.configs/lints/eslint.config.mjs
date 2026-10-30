import { asyncStyleConfigs, houseConfigs } from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs the naming convention, the house rules and the async style
// (`no-inline-await`, `no-return-await`). The VitePress site spells keys the theme API reads (`Layout`,
// `enhanceApp`), so the naming rule stays out of it.
export default [...houseConfigs, ...asyncStyleConfigs, { ignores: ['site/**'] }];
