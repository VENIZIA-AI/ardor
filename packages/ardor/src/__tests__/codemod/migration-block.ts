import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getError } from '@venizia/ignis-inversion';

import { REPOSITORY_ROOT } from '../vite/fixture';

const MIGRATION_FILE = 'docs/wiki/content/changelogs/0.4.8/migration.yaml';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The `before` and `after` snippets of the upgrade of one block of the 0.4.8 migration file, and its codemod name. */
export const readUpgradeBlock = (opts: {
  id: string;
}): { before: string; after: string; codemod: string } => {
  const parsed: unknown = Bun.YAML.parse(
    readFileSync(join(REPOSITORY_ROOT, MIGRATION_FILE), 'utf8'),
  );
  const block = isRecord(parsed) ? parsed[opts.id] : undefined;
  const upgrade = isRecord(block) ? block.upgrade : undefined;

  if (
    !isRecord(block) ||
    !isRecord(upgrade) ||
    typeof upgrade.before !== 'string' ||
    typeof upgrade.after !== 'string' ||
    typeof block.codemod !== 'string'
  ) {
    throw getError({ message: `[readUpgradeBlock] ${opts.id} has no before, after and codemod` });
  }

  return { before: upgrade.before, after: upgrade.after, codemod: block.codemod };
};
