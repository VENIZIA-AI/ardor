import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * A package of this repository depends on its siblings at the EXACT version released with it.
 * `@venizia/ardor` 0.1.4-3 once asked for `^0.1.4-3`, and a fresh install of it pulled 0.1.4-4 of the
 * others, which broke it. The manifests say `workspace:*` and `bun pack`/`bun publish` write the
 * sibling's own version, so a release can never leave a range behind. Cross-repo dependencies (IGNIS,
 * third party) keep their ranges.
 */
const ROOT = resolve(import.meta.dir, '..', '..', '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const DEPENDENCY_BLOCKS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

type TManifest = {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const readManifests = (): Array<TManifest> => {
  return readdirSync(PACKAGES_DIR)
    .map(dir => join(PACKAGES_DIR, dir, 'package.json'))
    .map(file => JSON.parse(readFileSync(file, 'utf8')) as TManifest)
    .filter(manifest => !manifest.private);
};

const manifests = readManifests();
const siblingNames = new Set(manifests.map(manifest => manifest.name));
const versionOf = new Map(manifests.map(manifest => [manifest.name, manifest.version]));

const versionFor = (name: string): string => {
  const version = versionOf.get(name);
  if (!version) {
    throw new Error(`no sibling named ${name}`);
  }
  return version;
};

const tmpDirs: Array<string> = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('sibling dependencies in the committed manifests', () => {
  test('every sibling of this repository is workspace:*, in every block', () => {
    const offenders: Array<string> = [];

    for (const manifest of manifests) {
      for (const block of DEPENDENCY_BLOCKS) {
        for (const [dependency, range] of Object.entries(manifest[block] ?? {})) {
          if (siblingNames.has(dependency) && range !== 'workspace:*') {
            offenders.push(`${manifest.name} ${block} ${dependency}: ${range}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test('the repository has siblings that depend on each other, so the rule is exercised', () => {
    const edges = manifests.flatMap(manifest => {
      return Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }).filter(name =>
        siblingNames.has(name),
      );
    });

    expect(edges.length).toBeGreaterThan(0);
  });

  test('a dependency outside this repository keeps its range', () => {
    const ignisRanges = manifests.flatMap(manifest => {
      return Object.entries({ ...manifest.peerDependencies }).filter(([name]) => {
        return name.startsWith('@venizia/ignis-');
      });
    });

    expect(ignisRanges.length).toBeGreaterThan(0);
    expect(ignisRanges.every(([, range]) => range.startsWith('^'))).toBe(true);
  });
});

describe('the packed manifest of each package', () => {
  const packed = new Map<string, TManifest>();

  const pack = async (opts: { dir: string }): Promise<TManifest> => {
    const out = mkdtempSync(join(tmpdir(), 'ardor-sibling-pack-'));
    tmpDirs.push(out);

    const proc = Bun.spawn(['bun', 'pm', 'pack', '--destination', out, '--quiet'], {
      cwd: join(PACKAGES_DIR, opts.dir),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(
        `bun pm pack failed in ${opts.dir}: ${await new Response(proc.stderr).text()}`,
      );
    }

    const tarball = readdirSync(out).find(file => file.endsWith('.tgz'));
    if (!tarball) {
      throw new Error(`bun pm pack made no tarball in ${opts.dir}`);
    }

    const tar = Bun.spawn(['tar', '-xzOf', join(out, tarball), 'package/package.json'], {
      stdout: 'pipe',
    });
    return JSON.parse(await new Response(tar.stdout).text()) as TManifest;
  };

  test('names each sibling at the exact version it is released with, and no protocol survives', async () => {
    for (const dir of readdirSync(PACKAGES_DIR)) {
      const manifest = JSON.parse(
        readFileSync(join(PACKAGES_DIR, dir, 'package.json'), 'utf8'),
      ) as TManifest;
      if (!manifest.private) {
        packed.set(manifest.name, await pack({ dir }));
      }
    }

    for (const [name, packedManifest] of packed) {
      for (const block of DEPENDENCY_BLOCKS) {
        for (const [dependency, range] of Object.entries(packedManifest[block] ?? {})) {
          expect(range.includes(':')).toBe(false);

          if (siblingNames.has(dependency)) {
            expect(`${name} ${block} ${dependency} ${range}`).toBe(
              `${name} ${block} ${dependency} ${versionFor(dependency)}`,
            );
          }
        }
      }
    }
  });

  test('the umbrella names all three siblings, exactly', () => {
    const umbrella = packed.get('@venizia/ardor');

    expect(umbrella?.dependencies).toEqual({
      '@venizia/ardor-admin': versionFor('@venizia/ardor-admin'),
      '@venizia/ardor-kernel': versionFor('@venizia/ardor-kernel'),
      '@venizia/ardor-react': versionFor('@venizia/ardor-react'),
    });
  });
});
