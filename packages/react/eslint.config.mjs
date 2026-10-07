import { reactConfigs } from '../../scripts/eslint/react.mjs';

import { secureContextRules } from '../../scripts/eslint/secure-context.mjs';

export default [...reactConfigs, ...secureContextRules];
