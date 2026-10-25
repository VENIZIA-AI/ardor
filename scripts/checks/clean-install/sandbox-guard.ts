/**
 * Makes the sandbox the only place a bare import may come from. The sandbox sits inside this
 * repository, so this repository's `node_modules` is above it and would answer an import the
 * sandbox cannot (a missing or optional peer), and the load would pass for the wrong reason.
 *
 * `createSandboxGuard` guards `Bun.build`. Bun's runtime plugins never see a bare import, so the Bun
 * runtime probe checks what it loaded afterwards (bun-probe.ts); Node uses a resolve hook (node-guard.mjs).
 */
import { realpathSync } from 'node:fs';
import { dirname, sep } from 'node:path';

const isBare = (specifier: string): boolean =>
  !/^(\.|\/|[a-z][a-z0-9+.-]*:)/i.test(specifier) || /^@/.test(specifier);

export const createSandboxGuard = (opts: { sandbox: string }): Bun.BunPlugin => {
  const sandbox = realpathSync(opts.sandbox);

  return {
    name: 'clean-install-sandbox-guard',
    setup: (build) => {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!isBare(args.path)) {
          return undefined;
        }

        let resolved: string;
        try {
          resolved = realpathSync(
            Bun.resolveSync(args.path, args.importer ? dirname(args.importer) : sandbox),
          );
        } catch {
          return undefined; // not found: the default resolution reports it
        }

        if (resolved !== sandbox && !resolved.startsWith(sandbox + sep)) {
          throw new Error(`'${args.path}' resolved outside the sandbox: ${resolved}`);
        }
        return undefined;
      });
    },
  };
};
