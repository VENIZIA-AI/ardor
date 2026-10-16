import { namingConventionConfigs } from '@venizia/dev-configs/linters';

// oxlint runs every other rule; ESLint keeps the one oxlint has no port of yet. The VitePress site
// spells keys the theme API reads (`Layout`, `enhanceApp`), so the naming rule stays out of it.
export default [...namingConventionConfigs, { ignores: ['site/**'] }];
