import type { VulcanConfig } from '@venizia/vulcan';
import { project, agent, guard, board, knowledge, common } from './vulcan/index.mts';

// ARDOR's project config for VULCAN (agent, knowledge and atlas tooling). okf, atlas and the manifest read
// the one `packages` list below; the release scripts and the Makefile keep their own.
export default { project, agent, guard, board, knowledge, common } satisfies VulcanConfig;
