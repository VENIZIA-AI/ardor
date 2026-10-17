/**
 * The `VULCAN` command the Makefile hands to `vulcan.mk`. VULCAN 0.1.0-0's `okf` and `atlas` tools
 * do not read `.configs/vulcan.config.ts` yet - they render IGNIS's packages, and on ARDOR they
 * empty the binding-key table and relabel the changelogs - so those commands run ARDOR's own
 * generators; every other command goes to VULCAN. Delete this file and the `VULCAN :=` line in the
 * Makefile once VULCAN reads the project config.
 */
import { spawnSync } from 'node:child_process';

const VULCAN_COMMAND = ['bun', 'x', '--no-install', 'vulcan'];

// `vulcan x <tool> <table> <gen|check>` -> the ARDOR script that owns that table.
const LOCAL_TABLES: Record<string, Record<string, string>> = {
  atlas: {
    surface: 'scripts/public-surface.ts',
    symbols: 'scripts/atlas-symbols.ts',
    releases: 'scripts/atlas-releases.ts',
  },
};

const LOCAL_OKF = '.agents/knowledge-tools/okf.ts';

/** The command line one `vulcan` invocation runs. `okf check --strict` is ARDOR's full check. */
export const resolveCommand = (opts: { args: string[] }): string[] => {
  const [command, tool, ...rest] = opts.args;

  if (command !== 'x' || tool === undefined) {
    return [...VULCAN_COMMAND, ...opts.args];
  }

  if (tool === 'okf') {
    return ['bun', LOCAL_OKF, ...rest.filter((arg) => arg !== '--strict')];
  }

  const [table, ...tableArgs] = rest;
  const script = table === undefined ? undefined : LOCAL_TABLES[tool]?.[table];

  return script === undefined ? [...VULCAN_COMMAND, ...opts.args] : ['bun', script, ...tableArgs];
};

if (import.meta.main) {
  const [executable, ...args] = resolveCommand({ args: process.argv.slice(2) });
  const result = spawnSync(executable, args, { stdio: 'inherit' });

  process.exit(result.status ?? 1);
}
