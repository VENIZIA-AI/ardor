import { eslintConfigs } from '@venizia/dev-configs';

import { secureContextRules } from '../../scripts/eslint/secure-context.mjs';

export default [...eslintConfigs, ...secureContextRules, { ignores: ['dist/'] }];
