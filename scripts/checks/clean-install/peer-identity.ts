/**
 * Run INSIDE a sandbox: for each holder (an ARDOR package) and each peer it declares, the file the
 * holder resolves the peer to must be the file the application resolves it to. Two files mean two
 * copies, whatever the lock says (a linker can lay a peer out twice).
 *
 * Usage: bun peer-identity.ts '<json: { holders: { name, peers }[] }>'   (cwd = the sandbox)
 * Prints a JSON array of problems; empty is a pass.
 */
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

type THolder = { name: string; peers: string[] };

const { holders } = JSON.parse(process.argv[2]) as { holders: THolder[] };
const sandbox = process.cwd();

const resolveFrom = (opts: { name: string; from: string }): string | undefined => {
  try {
    return realpathSync(Bun.resolveSync(opts.name, opts.from));
  } catch {
    return undefined;
  }
};

/** Where a holder lives: top level when the sandbox depends on it, else resolved through its parent. */
const locate = (opts: { name: string; parents: string[] }): string | undefined => {
  const top = join(sandbox, 'node_modules', opts.name);
  if (existsSync(top)) {
    return realpathSync(top);
  }

  for (const parent of opts.parents) {
    const found = resolveFrom({ name: `${opts.name}/package.json`, from: parent });
    if (found) {
      return join(found, '..');
    }
  }

  return undefined;
};

const problems: string[] = [];
const located: string[] = [];

for (const holder of holders) {
  const directory = locate({ name: holder.name, parents: located });
  if (!directory) {
    problems.push(`${holder.name} is not installed`);
    continue;
  }
  located.push(directory);

  for (const peer of holder.peers) {
    const own = resolveFrom({ name: peer, from: directory });
    const application = resolveFrom({ name: peer, from: sandbox });

    if (own === undefined && application === undefined) {
      continue; // an optional peer nobody installed
    }
    if (own !== application) {
      problems.push(`${holder.name} resolves ${peer} to ${own}, the application to ${application}`);
    }
  }
}

console.log(JSON.stringify(problems));
