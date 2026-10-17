/**
 * The `VULCAN` command the Makefile hands to `vulcan.mk`. VULCAN's `okf` tool and its release table
 * do not read `.configs/vulcan.config.ts` yet - they render IGNIS's packages, and on ARDOR they
 * empty the binding-key table and relabel the changelogs - so those commands run ARDOR's own
 * generators; every other command, the surface and symbol tables included, goes to VULCAN. Delete
 * this file and the `VULCAN :=` line in the Makefile once VULCAN reads the project config for both.
 */
import { spawnSync } from 'node:child_process';

const VULCAN_COMMAND = ['bun', 'x', '--no-install', 'vulcan'];

const LOCAL_OKF = '.agents/knowledge-tools/okf.ts';

const LOCAL_RELEASES = 'scripts/atlas-releases.ts';

/** The command line one `vulcan` invocation runs. `okf check --strict` is ARDOR's full check. */
export const resolveCommand = (opts: { args: string[] }): string[] => {
  const [command, tool, table, ...rest] = opts.args;

  if (command === 'x' && tool === 'okf') {
    return ['bun', LOCAL_OKF, ...opts.args.slice(2).filter((arg) => arg !== '--strict')];
  }

  if (command === 'x' && tool === 'atlas' && table === 'releases') {
    return ['bun', LOCAL_RELEASES, ...rest];
  }

  return [...VULCAN_COMMAND, ...opts.args];
};

if (import.meta.main) {
  const [executable, ...args] = resolveCommand({ args: process.argv.slice(2) });
  const result = spawnSync(executable, args, { stdio: 'inherit' });

  process.exit(result.status ?? 1);
}
