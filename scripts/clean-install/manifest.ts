import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What each published sub-path may need beyond its package's dependencies and required peers.
 * A sub-path with no grant must load with no optional peer installed - that default is the gate.
 */
export interface IInstallClaim {
  package: string;
  /** Optional peers a sub-path needs, keyed as spelled in `exports`. Each must be a declared peer. */
  requires?: Record<string, string[]>;
}

export const INSTALL_CLAIMS: IInstallClaim[] = [
  {
    package: 'kernel',
    requires: {
      './repository': ['@venizia/ignis-connectors'],
      './socket-io': ['socket.io-client'],
    },
  },
  { package: 'react' },
  { package: 'admin' },
  {
    package: 'ardor',
    requires: {
      './repository': ['@venizia/ignis-connectors'],
      './socket-io': ['socket.io-client'],
    },
  },
  { package: 'ui-kit' },
];

export interface IPackageManifest {
  name: string;
  private?: boolean;
  exports?: Record<string, string | Record<string, string>>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

export interface IInstallRow {
  package: string;
  name: string;
  subpath: string;
  specifier: string;
  /** The file `import` resolves to, repo-relative. */
  entry: string;
  extras: string[];
}

export const REPOSITORY_ROOT = join(import.meta.dir, '../..');

export const readPackageManifest = (opts: { package: string }): IPackageManifest =>
  JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'packages', opts.package, 'package.json'), 'utf8'));

/** Sub-paths that are not code a runtime imports: the manifest, JSON, and patterns (`./styles/*`). */
export const isCodeSubpath = (subpath: string): boolean =>
  subpath !== './package.json' && !subpath.endsWith('.json') && !subpath.includes('*');

const importTarget = (target: string | Record<string, string>): string | undefined =>
  typeof target === 'string' ? target : (target.import ?? target.default);

/** Every non-private workspace package needs a claim - an unclaimed one would get no check at all. */
export const assertEveryPackageClaimed = (opts: {
  claims: IInstallClaim[];
  directories: string[];
}): void => {
  for (const directory of opts.directories) {
    const manifest = readPackageManifest({ package: directory });
    if (manifest.private) {
      continue;
    }
    if (!opts.claims.some(claim => claim.package === directory)) {
      throw new Error(`[clean-install][manifest] '${manifest.name}' is published but has no claim`);
    }
  }
};

export const listPackageDirectories = (): string[] =>
  readdirSync(join(REPOSITORY_ROOT, 'packages'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => {
      try {
        readPackageManifest({ package: name });
        return true;
      } catch {
        return false;
      }
    });

/** Rows come from each `exports` map, so a new sub-path is gated the day it is published. */
export const deriveInstallRows = (opts: { claims: IInstallClaim[] }): IInstallRow[] => {
  const rows: IInstallRow[] = [];

  for (const claim of opts.claims) {
    const manifest = readPackageManifest({ package: claim.package });
    const exportsMap = manifest.exports ?? {};
    const peers = manifest.peerDependencies ?? {};

    for (const [subpath, extras] of Object.entries(claim.requires ?? {})) {
      if (!(subpath in exportsMap)) {
        throw new Error(
          `[clean-install][manifest] '${manifest.name}' grants '${subpath}', which its exports map does not publish`,
        );
      }
      for (const extra of extras) {
        if (!(extra in peers)) {
          throw new Error(
            `[clean-install][manifest] '${manifest.name}${subpath.slice(1)}' needs '${extra}', which is not a declared peer`,
          );
        }
      }
    }

    for (const [subpath, target] of Object.entries(exportsMap)) {
      if (!isCodeSubpath(subpath)) {
        continue;
      }
      const file = importTarget(target);
      if (!file) {
        throw new Error(
          `[clean-install][manifest] '${manifest.name}' ${subpath} has no import target`,
        );
      }
      rows.push({
        package: claim.package,
        name: manifest.name,
        subpath,
        specifier: subpath === '.' ? manifest.name : `${manifest.name}${subpath.slice(1)}`,
        entry: join('packages', claim.package, file),
        extras: [...(claim.requires?.[subpath] ?? [])].sort(),
      });
    }
  }

  return rows;
};

/**
 * Every packed package in a sandbox lock must resolve to its tarball, never a registry copy with the
 * same version. Nested keys (`"a/@venizia/ardor-kernel"`) count too.
 */
export const findLockMismatches = (opts: {
  lock: string;
  tarballs: Map<string, string>;
  sandboxed: string;
}): string[] => {
  const mismatches: string[] = [];
  for (const [name, file] of opts.tarballs) {
    const escaped = name.replace(/[/.-]/g, '\\$&');
    const pattern = new RegExp(`"(?:[^"]*/)?${escaped}": \\["${escaped}@([^"]+)"`, 'g');
    const matches = [...opts.lock.matchAll(pattern)];
    if (name === opts.sandboxed && matches.length === 0) {
      mismatches.push(`${name} is missing from the lock`);
    }
    for (const match of matches) {
      if (!match[1].includes(file)) {
        mismatches.push(`${name} resolves to '${match[1]}', not the packed tarball`);
      }
    }
  }
  return mismatches;
};
