import { houseConfigs } from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs the naming convention and the house rules. The VitePress site
// spells keys the theme API reads (`Layout`, `enhanceApp`), so the naming rule stays out of it.
export default [...houseConfigs, { ignores: ['site/**'] }];
