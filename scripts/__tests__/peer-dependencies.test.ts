import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isIdentityPeer } from '../clean-install/manifest';

/**
 * A package whose second copy breaks DI or context identity is a PEER of every ARDOR package that
 * uses it, never a dependency, and has one range across them. A dependency is hidden from the
 * application, which then cannot choose the one copy: `ra-i18n-polyglot` depends on `ra-core`, so
 * an application pinning an in-range `ra-core` got a second one nested under it. Every application
 * had to list these in `resolve.dedupe`.
 */
const ROOT = resolve(import.meta.dir, '..', '..');
const PACKAGES_DIR = join(ROOT, 'packages');

type TManifest = {
  name: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const directories = readdirSync(PACKAGES_DIR);
const manifestOf = (directory: string): TManifest => {
  return JSON.parse(readFileSync(join(PACKAGES_DIR, directory, 'package.json'), 'utf8'));
};
const manifests = directories.map(directory => ({ directory, manifest: manifestOf(directory) }));

/** The package names a source file imports from, by `from '...'`. */
const importedPackages = (opts: { directory: string }): Set<string> => {
  const found = new Set<string>();
  const source = join(PACKAGES_DIR, opts.directory, 'src');

  for (const entry of readdirSync(source, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || entry.parentPath.includes('__tests__')) {
      continue;
    }

    const text = readFileSync(join(entry.parentPath, entry.name), 'utf8');
    for (const match of text.matchAll(/from '((?:@[^/']+\/)?[^/'.][^/']*)(?:\/[^']*)?'/g)) {
      found.add(match[1]);
    }
  }

  return found;
};

describe('peer dependencies of the ARDOR packages', () => {
  test('no identity-sensitive package is a dependency', () => {
    const offenders = manifests.flatMap(({ manifest }) => {
      return Object.keys(manifest.dependencies ?? {})
        .filter(name => isIdentityPeer({ name }))
        .map(name => `${manifest.name} depends on ${name}`);
    });

    expect(offenders).toEqual([]);
  });

  test('a package that imports an identity-sensitive package declares it as a peer', () => {
    const missing: Array<string> = [];

    for (const { directory, manifest } of manifests) {
      const peers = manifest.peerDependencies ?? {};
      for (const imported of importedPackages({ directory })) {
        if (isIdentityPeer({ name: imported }) && !(imported in peers)) {
          missing.push(`${manifest.name} imports ${imported}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  test('one range across the ARDOR packages that name a peer', () => {
    const ranges = new Map<string, Map<string, Array<string>>>();

    for (const { manifest } of manifests) {
      for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
        const byRange = ranges.get(name) ?? new Map<string, Array<string>>();
        byRange.set(range, [...(byRange.get(range) ?? []), manifest.name]);
        ranges.set(name, byRange);
      }
    }

    const split = [...ranges]
      .filter(([, byRange]) => byRange.size > 1)
      .map(([name, byRange]) => `${name}: ${[...byRange.keys()].join(' vs ')}`);

    expect(split).toEqual([]);
  });

  test('the umbrella asks for every peer its siblings ask for, optional or not alike', () => {
    const umbrella = manifests.find(({ manifest }) => manifest.name === '@venizia/ardor')?.manifest;
    const siblings = manifests.filter(({ manifest }) => manifest.name !== '@venizia/ardor');

    const absent: Array<string> = [];
    const unlike: Array<string> = [];
    for (const { manifest } of siblings) {
      for (const name of Object.keys(manifest.peerDependencies ?? {})) {
        if (!umbrella?.peerDependencies || !(name in umbrella.peerDependencies)) {
          absent.push(`${manifest.name} peer ${name}`);
          continue;
        }

        const siblingOptional = manifest.peerDependenciesMeta?.[name]?.optional === true;
        const umbrellaOptional = umbrella.peerDependenciesMeta?.[name]?.optional === true;
        // A peer one sibling needs is needed by the umbrella that re-exports it.
        if (!siblingOptional && umbrellaOptional) {
          unlike.push(`${name} is required by ${manifest.name} and optional in the umbrella`);
        }
      }
    }

    expect(absent).toEqual([]);
    expect(unlike).toEqual([]);
  });
  test('a package forwards the required peers of the ARDOR packages it depends on, with the same range', () => {
    const byName = new Map(manifests.map(({ manifest }) => [manifest.name, manifest]));
    const unforwarded: Array<string> = [];

    for (const { manifest } of manifests) {
      for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        const sibling = byName.get(dependency);
        if (!sibling) {
          continue;
        }

        for (const [name, range] of Object.entries(sibling.peerDependencies ?? {})) {
          const isOptional = sibling.peerDependenciesMeta?.[name]?.optional === true;
          if (!isOptional && manifest.peerDependencies?.[name] !== range) {
            unforwarded.push(`${manifest.name} does not forward ${name} ${range} of ${dependency}`);
          }
        }
      }
    }

    // Otherwise the application does not own that copy: under an isolated linker the dependency gets
    // its own, and a second one appears the day the application installs another version.
    expect(unforwarded).toEqual([]);
  });
});
