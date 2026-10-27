import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { makeScratch } from '../../scratch';

import {
  exportTargets,
  isTarballLag,
  missingExportTargets,
  missingFromRegistry,
  nextTagsToHeal,
  parseChainReleased,
  TARBALL_LAG_DELAYS_SECONDS,
  unresolvedProtocols,
  parsePublished,
  withPublished,
  workspaceStrays,
} from '../release-gates';

const ROOT = resolve(import.meta.dir, '..', '..', '..');
const roots: string[] = [];

const temp = (): string => {
  const root = makeScratch({ prefix: 'release-gates-' });
  roots.push(root);
  return root;
};

const write = (root: string, path: string, content: string) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
};

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('exportTargets', () => {
  test('collects a string target, a conditions object and a nested sub-path', () => {
    const targets = exportTargets({
      exportsMap: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' },
        './repository': { types: './dist/repository.d.ts', import: './dist/repository.js' },
        './package.json': './package.json',
      },
    });
    expect([...targets].sort()).toEqual([
      './dist/index.d.ts',
      './dist/index.js',
      './dist/repository.d.ts',
      './dist/repository.js',
      './package.json',
    ]);
  });

  test('a missing exports map throws, naming it', () => {
    expect(() => exportTargets({ exportsMap: undefined })).toThrow('exports');
  });
});

describe('missingExportTargets', () => {
  test('lists the files the build did not emit, and only those', () => {
    const root = temp();
    write(root, 'dist/index.js', '');
    write(root, 'dist/index.d.ts', '');
    const missing = missingExportTargets({
      directory: root,
      exportsMap: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './x': './dist/x.js',
      },
    });
    expect(missing).toEqual(['./dist/x.js']);
  });
});

describe('unresolvedProtocols', () => {
  test('finds a catalog: or workspace: value that survived packing', () => {
    expect(
      unresolvedProtocols({
        manifest: {
          dependencies: { a: 'workspace:*', b: '^1.0.0' },
          peerDependencies: { c: 'catalog:' },
        },
      }),
    ).toEqual(['a: workspace:*', 'c: catalog:']);
  });

  test('a resolved manifest has none', () => {
    expect(unresolvedProtocols({ manifest: { dependencies: { a: '1.2.3' } } })).toEqual([]);
  });
});

describe('parseChainReleased', () => {
  test('splits a comma list, trims it and drops empty entries', () => {
    expect(parseChainReleased({ value: ' @venizia/a, @venizia/b ,,' })).toEqual([
      '@venizia/a',
      '@venizia/b',
    ]);
    expect(parseChainReleased({ value: '' })).toEqual([]);
  });
});

describe('missingFromRegistry', () => {
  const fetchFrom = (packuments: Record<string, string[]>) => async (opts: { name: string }) => {
    const versions = packuments[opts.name];
    return versions === undefined
      ? { ok: false as const, status: 404 }
      : { ok: true as const, versions };
  };

  test('a range some published version satisfies passes', async () => {
    const missing = await missingFromRegistry({
      dependencies: { a: '^1.0.0' },
      chainReleased: [],
      workspaceVersions: new Map(),
      fetchPackument: fetchFrom({ a: ['1.0.0', '1.2.0'] }),
    });
    expect(missing).toEqual([]);
  });

  test('a range no published version satisfies is reported with the range', async () => {
    const missing = await missingFromRegistry({
      dependencies: { a: '0.4.0' },
      chainReleased: [],
      workspaceVersions: new Map(),
      fetchPackument: fetchFrom({ a: ['0.3.0'] }),
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toContain('a@0.4.0');
  });

  test('a package the registry has never heard of is reported', async () => {
    const missing = await missingFromRegistry({
      dependencies: { ghost: '1.0.0' },
      chainReleased: [],
      workspaceVersions: new Map(),
      fetchPackument: fetchFrom({}),
    });
    expect(missing[0]).toContain('ghost@1.0.0');
    expect(missing[0]).toContain('404');
  });

  test('a network failure is a failure, not a pass', async () => {
    const missing = await missingFromRegistry({
      dependencies: { a: '1.0.0' },
      chainReleased: [],
      workspaceVersions: new Map(),
      fetchPackument: async () => {
        throw new Error('ECONNRESET');
      },
    });
    expect(missing[0]).toContain('ECONNRESET');
  });

  test('a package named in chainReleased is checked against its workspace version, not the registry', async () => {
    const missing = await missingFromRegistry({
      dependencies: { '@venizia/ardor-kernel': '0.3.1' },
      chainReleased: ['@venizia/ardor-kernel'],
      workspaceVersions: new Map([['@venizia/ardor-kernel', '0.3.1']]),
      fetchPackument: fetchFrom({}),
    });
    expect(missing).toEqual([]);
  });

  test('chainReleased does not excuse a workspace version that misses the range', async () => {
    const missing = await missingFromRegistry({
      dependencies: { '@venizia/ardor-kernel': '0.4.0' },
      chainReleased: ['@venizia/ardor-kernel'],
      workspaceVersions: new Map([['@venizia/ardor-kernel', '0.3.1']]),
      fetchPackument: fetchFrom({}),
    });
    expect(missing).toHaveLength(1);
  });
});

describe('workspaceStrays', () => {
  test('a sibling that resolves into node_modules is a stray; a link into the workspace is not', () => {
    const root = temp();
    write(
      root,
      'packages/a/package.json',
      JSON.stringify({ name: '@venizia/ardor-a', version: '1.0.0' }),
    );
    write(
      root,
      'packages/b/package.json',
      JSON.stringify({
        name: '@venizia/ardor-b',
        dependencies: {
          '@venizia/ardor-a': '1.0.0',
          '@venizia/ardor-c': '1.0.0',
          '@venizia/ignis-kernel': '^0.3.0',
        },
      }),
    );
    // a is linked to its workspace folder
    mkdirSync(join(root, 'node_modules/@venizia'), { recursive: true });
    symlinkSync(join(root, 'packages/a'), join(root, 'node_modules/@venizia/ardor-a'));
    // c is a published copy inside node_modules
    write(
      root,
      'node_modules/@venizia/ardor-c/package.json',
      JSON.stringify({ name: '@venizia/ardor-c', version: '0.9.0' }),
    );

    const strays = workspaceStrays({ root, directory: 'packages/b', prefix: '@venizia/ardor' });
    expect(strays).toHaveLength(1);
    expect(strays[0]).toContain('@venizia/ardor-c');
    expect(strays[0]).toContain('0.9.0');
  });

  test('a declared sibling that is not installed is reported', () => {
    const root = temp();
    write(
      root,
      'packages/b/package.json',
      JSON.stringify({ name: 'b', dependencies: { '@venizia/ardor-z': '1.0.0' } }),
    );
    const strays = workspaceStrays({ root, directory: 'packages/b', prefix: '@venizia/ardor' });
    expect(strays[0]).toContain('not installed');
  });
});

describe('package-release.yml follows IGNIS: gates first, publish first, no force-push', () => {
  const workflow = readFileSync(join(ROOT, '.github/workflows/package-release.yml'), 'utf8');
  const at = (name: string): number => workflow.indexOf(`- name: ${name}`);

  test.each([
    'Assert internal dependencies link to the workspace',
    'Purity probe self-test',
    'Purity gate',
    'Clean-install gate',
    'Validate build artifacts',
    'Check dependency catalog',
    'Assert the publisher is bun',
    'Pack the release tarball',
    'Validate packed manifest',
    'Validate dependencies exist on the registry',
  ])('it has the gate "%s"', (name) => {
    expect(at(name)).toBeGreaterThan(-1);
  });

  test('every gate runs through scripts/release/release-gates.ts', () => {
    for (const command of ['links', 'artifacts', 'pack', 'protocols', 'registry']) {
      expect(workflow).toContain(`scripts/release/release-gates.ts ${command}`);
    }
  });

  test('the gates run before the version bump, the publish before any git write', () => {
    expect(at('Validate dependencies exist on the registry')).toBeLessThan(at('Version bump'));
    expect(at('Version bump')).toBeLessThan(at('Publish to NPM'));
    expect(at('Publish to NPM')).toBeLessThan(at('Tag highest version on NPM'));
    expect(at('Tag highest version on NPM')).toBeLessThan(
      at('Keep the next tag at or above latest'),
    );
    expect(at('Keep the next tag at or above latest')).toBeLessThan(at('Commit release'));
    expect(at('Commit release')).toBeLessThan(at('Push release'));
    expect(at('Push release')).toBeLessThan(at('Create tag'));
  });

  test('a failed run is reported, never repaired by a force-push', () => {
    expect(workflow).not.toContain('--force');
    expect(workflow).not.toContain('reset --hard');
    expect(workflow).toContain('Report - published, develop not updated');
    expect(workflow).toContain('Report - published and pushed, tag missing');
  });

  test('next is healed after the publish, non-fatally', () => {
    expect(workflow).toMatch(
      /Keep the next tag at or above latest\n\s+continue-on-error: true\n\s+run: bun scripts\/release\/release-gates.ts heal-next/,
    );
  });

  test('one release at a time', () => {
    expect(workflow).toMatch(/concurrency:\n\s+group: npm-release\n\s+cancel-in-progress: false/);
  });

  test('it takes the issue and chain_released inputs', () => {
    expect(workflow).toMatch(/\n      issue:\n\s+type: string/);
    expect(workflow).toMatch(/\n      chain_released:\n\s+type: string/);
    expect(workflow).toContain('RELEASE_ISSUE');
    expect(workflow).toContain('--chain-released');
  });

  test('the actions are pinned by commit with the tag IGNIS uses, and bun is exact', () => {
    expect(workflow).toMatch(/actions\/checkout@[0-9a-f]{40} # v6\.0\.3/);
    expect(workflow).toMatch(/actions\/setup-node@[0-9a-f]{40} # v6\.4\.0/);
    expect(workflow).toContain('bun-version: 1.4.4');
    expect(workflow).not.toContain('bun-version: latest');
    expect(workflow).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true');
  });

  test('the ARDOR-only steps stay: the preset, the version input, the catalog refresh', () => {
    expect(workflow).toContain('make preset-smoke');
    expect(workflow).toContain('scripts/preset/vulcan-preset.ts');
    expect(workflow).toContain('scripts/release/release-version.ts target');
    expect(workflow).toContain('scripts/build/refresh-catalog.ts highest');
  });
});

describe('nextTagsToHeal: `next` is never below `latest`', () => {
  test('a prerelease of a release is below it', () => {
    expect(nextTagsToHeal({ packages: [{ name: 'a', latest: '0.3.0', next: '0.3.0-1' }] })).toEqual(
      [{ name: 'a', latest: '0.3.0' }],
    );
  });

  test('0.1.4-5 is below 0.3.0', () => {
    expect(nextTagsToHeal({ packages: [{ name: 'a', latest: '0.3.0', next: '0.1.4-5' }] })).toEqual(
      [{ name: 'a', latest: '0.3.0' }],
    );
  });

  test('equal passes', () => {
    expect(nextTagsToHeal({ packages: [{ name: 'a', latest: '0.3.0', next: '0.3.0' }] })).toEqual(
      [],
    );
  });

  test('a next above latest passes (a beta of the next version)', () => {
    expect(nextTagsToHeal({ packages: [{ name: 'a', latest: '0.3.0', next: '0.4.0-0' }] })).toEqual(
      [],
    );
  });

  test('a missing next is healed', () => {
    expect(nextTagsToHeal({ packages: [{ name: 'a', latest: '0.3.0' }] })).toEqual([
      { name: 'a', latest: '0.3.0' },
    ]);
  });

  test('a package with no latest has nothing to heal toward', () => {
    expect(nextTagsToHeal({ packages: [{ name: 'a', next: '0.1.0-0' }, { name: 'b' }] })).toEqual(
      [],
    );
  });

  test('every package is looked at, in order', () => {
    const healed = nextTagsToHeal({
      packages: [
        { name: 'a', latest: '0.3.0', next: '0.1.4-5' },
        { name: 'b', latest: '0.3.0', next: '0.3.0' },
        { name: 'c', latest: '0.3.1', next: '0.3.1-0' },
      ],
    });
    expect(healed.map((entry) => entry.name)).toEqual(['a', 'c']);
  });
});

describe('isTarballLag: a 404 on a @venizia tarball just after a publish', () => {
  test('matches the line bun prints', () => {
    expect(
      isTarballLag({
        output:
          'error: GET https://registry.npmjs.org/@venizia/vulcan-okf/-/vulcan-okf-0.3.1.tgz - 404\n',
      }),
    ).toBe(true);
  });

  test('matches when other lines surround it', () => {
    expect(
      isTarballLag({
        output:
          'Resolving dependencies\nerror: GET https://registry.npmjs.org/@venizia/vulcan/-/vulcan-0.3.1.tgz - 404\n\nerror: GET https://registry.npmjs.org/@venizia/vulcan-atlas/-/vulcan-atlas-0.3.1.tgz - 404\n',
      }),
    ).toBe(true);
  });

  test('a 404 on another scope does not match', () => {
    expect(
      isTarballLag({
        output: 'error: GET https://registry.npmjs.org/lodash/-/lodash-9.9.9.tgz - 404',
      }),
    ).toBe(false);
  });

  test('another failure of a @venizia package does not match', () => {
    expect(
      isTarballLag({
        output: 'error: GET https://registry.npmjs.org/@venizia/vulcan/-/vulcan-0.3.1.tgz - 500',
      }),
    ).toBe(false);
    expect(isTarballLag({ output: 'error: lint failed' })).toBe(false);
  });

  test('the backoff is six tries over about five minutes', () => {
    expect(TARBALL_LAG_DELAYS_SECONDS).toHaveLength(5);
    expect(
      TARBALL_LAG_DELAYS_SECONDS.reduce((sum, seconds) => sum + seconds, 0),
    ).toBeGreaterThanOrEqual(240);
    expect(
      TARBALL_LAG_DELAYS_SECONDS.reduce((sum, seconds) => sum + seconds, 0),
    ).toBeLessThanOrEqual(330);
  });
});

describe('withPublished: the version just published beats a stale registry read', () => {
  test('a stale registry latest loses to the published version', () => {
    const packages = withPublished({
      packages: [{ name: 'a', latest: '0.3.0', next: '0.3.0' }],
      published: { name: 'a', version: '0.3.1', tag: 'latest' },
    });
    expect(packages).toEqual([{ name: 'a', latest: '0.3.1', next: '0.3.0' }]);
    expect(nextTagsToHeal({ packages })).toEqual([{ name: 'a', latest: '0.3.1' }]);
  });

  test('a published prerelease on next leaves latest to the registry', () => {
    const packages = withPublished({
      packages: [{ name: 'a', latest: '0.3.0', next: '0.2.0' }],
      published: { name: 'a', version: '0.4.0-0', tag: 'next' },
    });
    expect(packages).toEqual([{ name: 'a', latest: '0.3.0', next: '0.4.0-0' }]);
    expect(nextTagsToHeal({ packages })).toEqual([]);
  });

  test('the other packages keep what the registry said', () => {
    const packages = withPublished({
      packages: [
        { name: 'a', latest: '0.3.0', next: '0.3.0' },
        { name: 'b', latest: '0.3.0', next: '0.1.4-5' },
      ],
      published: { name: 'a', version: '0.3.1', tag: 'latest' },
    });
    expect(packages[1]).toEqual({ name: 'b', latest: '0.3.0', next: '0.1.4-5' });
    expect(nextTagsToHeal({ packages }).map((entry) => entry.name)).toEqual(['a', 'b']);
  });

  test('a published package the registry did not list is added', () => {
    expect(
      withPublished({ packages: [], published: { name: 'a', version: '0.3.1', tag: 'latest' } }),
    ).toEqual([{ name: 'a', latest: '0.3.1' }]);
  });

  test('no published package changes nothing', () => {
    const packages = [{ name: 'a', latest: '0.3.0', next: '0.1.0' }];
    expect(withPublished({ packages })).toEqual(packages);
  });
});

describe('parsePublished: --published <name>@<version> --tag <tag>', () => {
  test('reads a scoped name, a version and a tag', () => {
    expect(
      parsePublished({ argv: ['--published', '@venizia/ardor@0.3.1', '--tag', 'latest'] }),
    ).toEqual({ name: '@venizia/ardor', version: '0.3.1', tag: 'latest' });
  });

  test('neither flag means nothing was published', () => {
    expect(parsePublished({ argv: ['--dry-run'] })).toBeUndefined();
  });

  test('a published without a tag, or an unknown tag, throws', () => {
    expect(() => parsePublished({ argv: ['--published', '@venizia/ardor@0.3.1'] })).toThrow(
      '--tag',
    );
    expect(() =>
      parsePublished({ argv: ['--published', '@venizia/ardor@0.3.1', '--tag', 'beta'] }),
    ).toThrow('beta');
  });

  test('a published that is not name@version throws', () => {
    expect(() =>
      parsePublished({ argv: ['--published', '@venizia/ardor', '--tag', 'latest'] }),
    ).toThrow('@venizia/ardor');
    expect(() => parsePublished({ argv: ['--published', 'a@x.y', '--tag', 'latest'] })).toThrow(
      'x.y',
    );
  });
});

describe('the workflow passes what it published, and can heal alone', () => {
  const workflow = readFileSync(join(ROOT, '.github/workflows/package-release.yml'), 'utf8');

  test('the heal step is given the published package, version and tag', () => {
    expect(workflow).toContain(
      'release-gates.ts heal-next --published "$PACKAGE_NAME@$NEW_VERSION" --tag "$NPM_TAG"',
    );
  });

  test('a heal_only dispatch runs only the heal job; a release skips it', () => {
    expect(workflow).toMatch(/\n      heal_only:\n\s+type: boolean/);
    expect(workflow).toMatch(
      /\n  heal-next:\n\s+name: Heal next tags\n\s+if: \$\{\{ github.ref == 'refs\/heads\/develop' && inputs.heal_only == true \}\}/,
    );
    expect(workflow).toMatch(
      /\n  release:\n\s+name: NPM Release\n\s+needs: test\n\s+if: \$\{\{ github.ref == 'refs\/heads\/develop' && inputs.heal_only != true \}\}/,
    );
  });
});

// The release workflow is read as text, like the tests above. Each guard is a function of the workflow
// text; the real file satisfies every guard, and a copy with ONE guard removed fails exactly that one,
// so a guard that stops detecting anything cannot pass unnoticed. A pull request that removes a guard
// and its test together still passes: this stops accidents, not an author.
describe('package-release.yml guards, one mutation per guard', () => {
  const workflow = readFileSync(join(ROOT, '.github/workflows/package-release.yml'), 'utf8');
  const presetSmoke = readFileSync(join(ROOT, 'scripts/preset/preset-smoke.ts'), 'utf8');
  const vulcanPin: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    .devDependencies['@venizia/vulcan'];

  const headOf = (text: string): string => text.split(/\njobs:\n/)[0] ?? '';

  /** The text of each job: from `  <name>:` under `jobs:` to the next job. */
  const jobsOf = (text: string): Record<string, string> => {
    const section = text.split(/\njobs:\n/)[1] ?? '';
    const starts = [...section.matchAll(/^  ([\w-]+):\s*$/gm)];

    return Object.fromEntries(
      starts.map((start, index) => [
        start[1] ?? '',
        section.slice(start.index, starts[index + 1]?.index ?? section.length),
      ]),
    );
  };

  /** The steps of a job, each with its name and its text. */
  const stepsOf = (job: string): Array<{ name: string; text: string }> =>
    job
      .split(/\n {6}- name: /)
      .slice(1)
      .map((chunk) => ({ name: chunk.split('\n')[0] ?? '', text: chunk }));

  const NPM_STEPS = [
    'Publish to NPM',
    'Tag highest version on NPM',
    'Keep the next tag at or above latest',
    'Move next to latest where it is below',
  ];

  const guards = {
    // C1: the release, test and heal jobs run only for develop.
    developOnly: (text: string): boolean => {
      const jobs = jobsOf(text);

      return ['test', 'release', 'heal-next'].every((name) =>
        /\n {4}if: .*github\.ref == 'refs\/heads\/develop'/.test(jobs[name] ?? ''),
      );
    },
    // C2: read-only by default; only the release job writes.
    minimalPermissions: (text: string): boolean => {
      const jobs = jobsOf(text);

      return (
        /\npermissions:\n {2}contents: read\n/.test(headOf(text)) &&
        /\n {4}permissions:\n {6}contents: write\n/.test(jobs.release ?? '') &&
        !(jobs.test ?? '').includes('contents: write') &&
        !(jobs['heal-next'] ?? '').includes('contents: write')
      );
    },
    // C3: the release job needs a test job that has no secret.
    testJobNeeded: (text: string): boolean => {
      const jobs = jobsOf(text);

      return (
        /\n {4}needs: test\n/.test(jobs.release ?? '') &&
        (jobs.test ?? '').length > 0 &&
        !(jobs.test ?? '').includes('secrets.') &&
        !(jobs.test ?? '').includes('contents: write')
      );
    },
    // C5: an exact bun in every setup.
    exactBun: (text: string): boolean => {
      const versions = [...text.matchAll(/bun-version: (.+)/g)].map((match) => match[1] ?? '');

      return versions.length >= 3 && versions.every((version) => /^\d+\.\d+\.\d+$/.test(version));
    },
    // C6: the registry credential, and every secret, only in the publish and dist-tag steps.
    secretsInPublishSteps: (text: string): boolean => {
      const jobs = jobsOf(text);
      const everyReference = [...text.matchAll(/secrets\.(\w+)/g)].every(
        (match) => match[1] === 'NPM_ACCESS_TOKEN',
      );
      const placed = ['release', 'heal-next'].every((name) => {
        const withSecret = stepsOf(jobs[name] ?? '').filter((step) =>
          step.text.includes('secrets.'),
        );

        return withSecret.length > 0 && withSecret.every((step) => NPM_STEPS.includes(step.name));
      });

      return everyReference && placed;
    },
    // C17: every checkout is the dispatched commit; no step moves to a branch; the run name carries it.
    dispatchedCommit: (text: string): boolean => {
      const jobs = jobsOf(text);
      const checkouts = Object.values(jobs).flatMap((job) =>
        stepsOf(job).filter((step) => step.text.includes('uses: actions/checkout@')),
      );
      const runName = text.match(/^run-name: (.+)$/m)?.[1] ?? '';

      return (
        checkouts.length >= 3 &&
        checkouts.every((step) => /\n {10}ref: \$\{\{ github\.sha \}\}/.test(step.text)) &&
        !/git checkout develop|git pull origin develop|git switch develop/.test(text) &&
        runName.includes('github.sha')
      );
    },
    // D6: every action by its full commit, with the tag in a comment.
    actionsByCommit: (text: string): boolean => {
      const uses = [...text.matchAll(/^\s+uses: (.+)$/gm)].map((match) => match[1] ?? '');

      return (
        uses.length >= 9 &&
        uses.every((value) => /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/.test(value))
      );
    },
    // C4: preset-smoke runs the VULCAN the repository pins, and `latest` appears nowhere.
    pinnedVulcan: (text: string, script: string): boolean =>
      text.match(/VULCAN_CMD: bun x @venizia\/vulcan@(\S+)/)?.[1] === vulcanPin &&
      !/@latest|bun-version: latest/.test(text) &&
      !script.includes('@venizia/vulcan@latest'),
  };

  const mutations: Array<{
    guard: keyof typeof guards;
    name: string;
    mutate: (text: string) => string;
  }> = [
    {
      guard: 'developOnly',
      name: 'the heal job loses the develop condition',
      mutate: (text) =>
        text.replace(
          "github.ref == 'refs/heads/develop' && inputs.heal_only == true",
          'inputs.heal_only == true',
        ),
    },
    {
      guard: 'developOnly',
      name: 'the release job loses the develop condition',
      mutate: (text) =>
        text.replace(
          "github.ref == 'refs/heads/develop' && inputs.heal_only != true",
          'inputs.heal_only != true',
        ),
    },
    {
      guard: 'minimalPermissions',
      name: 'the workflow default is write',
      mutate: (text) =>
        text.replace('\npermissions:\n  contents: read\n', '\npermissions:\n  contents: write\n'),
    },
    {
      guard: 'minimalPermissions',
      name: 'the release job loses its write grant',
      mutate: (text) => text.replace('    permissions:\n      contents: write\n', ''),
    },
    {
      guard: 'testJobNeeded',
      name: 'the release job no longer needs the test job',
      mutate: (text) => text.replace('    needs: test\n', ''),
    },
    {
      guard: 'testJobNeeded',
      name: 'the test job reads the registry credential',
      mutate: (text) =>
        text.replace(
          '      - name: Install\n        run: bun install\n',
          '      - name: Install\n        run: bun install\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}\n',
        ),
    },
    {
      guard: 'exactBun',
      name: 'bun is latest',
      mutate: (text) => text.replace(/bun-version: \d+\.\d+\.\d+/, 'bun-version: latest'),
    },
    {
      guard: 'secretsInPublishSteps',
      name: 'the credential is read by a build step',
      mutate: (text) =>
        text.replace(
          '      - name: Version bump\n',
          '      - name: Version bump\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}\n',
        ),
    },
    {
      guard: 'dispatchedCommit',
      name: 'a checkout names a branch',
      mutate: (text) => text.replace('ref: ${{ github.sha }}', 'ref: develop'),
    },
    {
      guard: 'dispatchedCommit',
      name: 'the step that moves to develop is back',
      mutate: (text) =>
        text.replace(
          '      - name: Version bump\n',
          '      - name: Sync develop\n        run: git fetch origin && git checkout develop && git pull origin develop\n\n      - name: Version bump\n',
        ),
    },
    {
      guard: 'dispatchedCommit',
      name: 'the run name drops the commit',
      mutate: (text) => text.replace(/^(run-name: .*) \| \$\{\{ github\.sha \}\}/m, '$1'),
    },
    {
      guard: 'actionsByCommit',
      name: 'an action goes back to a tag',
      mutate: (text) =>
        text.replace(/actions\/checkout@[0-9a-f]{40} # v6\.0\.3/, 'actions/checkout@v6.0.3'),
    },
  ];

  test.each(Object.keys(guards).filter((name) => name !== 'pinnedVulcan'))(
    'the real workflow satisfies the guard %s',
    (name) => {
      expect(guards[name as keyof typeof guards](workflow, presetSmoke)).toBe(true);
    },
  );

  test('the real workflow and the smoke script run the pinned VULCAN', () => {
    expect(guards.pinnedVulcan(workflow, presetSmoke)).toBe(true);
  });

  test.each(mutations)('$guard fails when $name', ({ guard, mutate }) => {
    const mutated = mutate(workflow);

    expect(mutated).not.toBe(workflow);
    expect(guards[guard](mutated, presetSmoke)).toBe(false);
  });

  test('pinnedVulcan fails when preset-smoke asks for the latest VULCAN', () => {
    expect(
      guards.pinnedVulcan(
        workflow.replace(
          /VULCAN_CMD: bun x @venizia\/vulcan@\S+/,
          'VULCAN_CMD: bun x @venizia/vulcan@latest',
        ),
        presetSmoke,
      ),
    ).toBe(false);
    expect(
      guards.pinnedVulcan(
        workflow,
        presetSmoke.replace(/bun x @venizia\/vulcan@\S+/, 'bun x @venizia/vulcan@latest'),
      ),
    ).toBe(false);
  });

  test('a guard needs the jobs it reads', () => {
    expect(Object.keys(jobsOf(workflow)).toSorted()).toEqual(['heal-next', 'release', 'test']);
  });
});
