import { reactHouseConfigs } from '@venizia/dev-configs/linters';

// oxlint runs the shared rules; ESLint runs what oxlint cannot: the naming convention, the house rules
// and `no-leaked-render`.
export default reactHouseConfigs;
