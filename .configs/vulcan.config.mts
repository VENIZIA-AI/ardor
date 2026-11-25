import type { VulcanConfig } from '@venizia/vulcan';
import { project, agent, guard, board, knowledge, check, common } from './vulcan/index.mts';

// ARDOR's project config for VULCAN (agent, knowledge and atlas tooling). okf, atlas and the manifest read
// the one `packages` list in `vulcan/project.mts`; the release scripts and the Makefile keep their own.
export default {
  project,
  agent,
  guard,
  board,
  knowledge,
  check,
  common,
} satisfies VulcanConfig;
