import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { makeScratch } from '../../scratch';
import { ReleaseChain, type TStep } from '../release-chain';

import {
  duplicateCopies,
  lockedVersions,
  exportTargets,
  isTarballLag,
  isTrustedPublishWorkflow,
  missingExportTargets,
  missingFromRegistry,
  nextTagsToHeal,
  parseChainReleased,
  prereleaseRanges,
  shouldMoveHighest,
  TARBALL_LAG_DELAYS_SECONDS,
  unresolvedProtocols,
  parsePublished,
  withPublished,
  workspaceMembers,
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

const workflowText = readFileSync(join(ROOT, '.github/workflows/package-release.yml'), 'utf8');
const chainText = readFileSync(join(ROOT, 'scripts/release/release-chain.ts'), 'utf8');

const withoutComments = (text: string): string => text.replace(/^\s*(#|\/\/|\*|\/\*).*$/gm, '');

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

const NAMES: Record<string, string> = {
  kernel: '@venizia/ardor-kernel',
  react: '@venizia/ardor-react',
  admin: '@venizia/ardor-admin',
  ardor: '@venizia/ardor',
};

const chainPlan = ReleaseChain.plan({
  options: {
    packages: Object.entries(NAMES).map(([name, packageName]) => ({ name, packageName })),
    version: '0.4.6-0',
    npmTag: 'next',
    tarballs: '/work/tarballs',
    tmp: '/work/tmp',
    chainReleased: Object.values(NAMES),
  },
});

/** The labels of one package's steps, in order, without the package prefix. */
const labelsOf = (opts: { steps: TStep[]; name: string }): string[] =>
  opts.steps
    .filter((step) => step.label.startsWith(`${opts.name}: `))
    .map((step) => step.label.slice(opts.name.length + 2));

const inOrder = (opts: { labels: string[]; order: string[] }): boolean => {
  const positions = opts.order.map((label) => opts.labels.indexOf(label));

  return positions.every(
    (position, index) => position > -1 && position > (positions[index - 1] ?? -1),
  );
};

describe('package-release.yml and release-chain.ts follow IGNIS: gates first, publish first, no force-push', () => {
  const workflow = workflowText;
  const testJob = jobsOf(workflow).test ?? '';
  const releaseJob = jobsOf(workflow).publish ?? '';
  const loops = 'for package in ${PACKAGES//,/ }; do';

  test.each([
    'Assert internal dependencies link to the workspace',
    'Build',
    'Lint',
    'Test the package',
    'Purity gate',
  ])('the test job runs "%s" for every package of the run', (name) => {
    const step = stepsOf(testJob).find((candidate) => candidate.name === name);

    expect(step?.text).toContain(loops);
  });

  test.each([
    'Test the repository scripts',
    'Purity probe self-test',
    'Check dependency catalog',
    'VULCAN preset smoke',
  ])('the test job runs "%s" once', (name) => {
    const found = stepsOf(testJob).filter((candidate) => candidate.name === name);

    expect(found).toHaveLength(1);
    expect(found[0]?.text).not.toContain(loops);
  });

  test("clean-install is the chain's, after the sibling is out, and not the test job's", () => {
    expect(testJob).not.toContain('clean-install');
    expect(chainPlan.phaseB.some((step) => step.label === 'react: clean-install')).toBe(true);
  });

  test('the publish job checks the branches, installs, releases and reports, in that order', () => {
    const names = stepsOf(releaseJob).map((step) => step.name);

    expect(
      inOrder({
        labels: names,
        order: [
          'Refuse a stable when a branch moved since the plan',
          'Install the npm that publishes',
          'Force update workspace',
          'Install',
          'Release the packages',
          'Report the run',
        ],
      }),
    ).toBe(true);
  });

  test('every gate runs through scripts/release/release-gates.ts, in phase A', () => {
    const phaseA = chainPlan.phaseA.map((step) =>
      'command' in step ? step.command.join(' ') : '',
    );

    for (const command of ['links', 'artifacts', 'pack', 'protocols', 'registry']) {
      expect(
        phaseA.some((line) => line.includes(`scripts/release/release-gates.ts ${command}`)),
      ).toBe(true);
    }
  });

  test('phase A of a package is links, build, artifacts, pack, protocols, registry', () => {
    expect(labelsOf({ steps: chainPlan.phaseA, name: 'react' })).toEqual([
      'links',
      'build',
      'artifacts',
      'pack',
      'protocols',
      'registry',
    ]);
  });

  test('phase A holds six checks per package and neither a publish nor a git write', () => {
    expect(chainPlan.phaseA).toHaveLength(24);
    expect(chainPlan.phaseA.some((step) => step.kind === 'publish')).toBe(false);
    expect(chainPlan.phaseA.some((step) => 'command' in step && step.command.includes('git'))).toBe(
      false,
    );
  });

  test('the bump comes before the pack, the publish before any git write', () => {
    expect(
      inOrder({
        labels: labelsOf({ steps: chainPlan.phaseB, name: 'react' }),
        order: [
          'clean-install',
          'bump',
          'pack the tarball to publish',
          'check the packed manifest',
          'record the sha256',
          'check the sha256',
          'publish',
          'wait for the tarball to answer 200',
          'tag highest',
          'keep next at or above latest',
          'commit',
          'push',
          'annotate the tag',
          'push the tag',
        ],
      }),
    ).toBe(true);
  });

  test('the preset is written after the bump and before the pack, for ardor only', () => {
    const indexOfLabel = (label: string): number =>
      chainPlan.phaseB.findIndex((step) => step.label === label);
    const presets = chainPlan.phaseB.filter((step) => step.label.includes('VULCAN preset'));

    expect(presets).toHaveLength(1);
    expect(indexOfLabel('ardor: write the VULCAN preset')).toBeGreaterThan(
      indexOfLabel('ardor: bump'),
    );
    expect(indexOfLabel('ardor: write the VULCAN preset')).toBeLessThan(
      indexOfLabel('ardor: pack the tarball to publish'),
    );
  });

  test('a failed run is reported, never repaired by a force-push or a rebase', () => {
    const code = withoutComments(chainText);

    expect(code).not.toMatch(/--force|reset --hard|'pull'|'rebase'/);
    expect(workflowText).not.toContain('--force');
    expect(workflowText).not.toContain('reset --hard');
    expect(workflowText).toContain('- name: Report the run');
  });

  test('the dist-tag and the next heal come after the publish and never stop the chain', () => {
    const steps = chainPlan.phaseB.filter((step) => step.label.startsWith('react: '));
    const publish = steps.findIndex((step) => step.kind === 'publish');
    const highest = steps.find((step) => step.label === 'react: tag highest');
    const heal = steps.find((step) => step.label === 'react: keep next at or above latest');

    expect(highest && 'fatal' in highest && highest.fatal).toBe(false);
    expect(heal && 'fatal' in heal && heal.fatal).toBe(false);
    expect(steps.indexOf(highest as TStep)).toBeGreaterThan(publish);
    expect(steps.indexOf(heal as TStep)).toBeGreaterThan(publish);
  });

  test('one release at a time', () => {
    expect(workflow).toMatch(/concurrency:\n\s+group: npm-release\n\s+cancel-in-progress: false/);
  });

  test('it takes the packages and issue inputs and no per-package or chain input', () => {
    expect(workflow).toMatch(/\n      packages:\n\s+type: string/);
    expect(workflow).toMatch(/\n      issue:\n\s+type: string/);
    expect(workflow).toContain('RELEASE_ISSUE');
    expect(workflow).not.toContain('chain_released');
    expect(workflow).not.toMatch(/\n      package:\n/);
    expect(chainText).toContain("'--chain-released'");
  });

  test('the actions are pinned by commit with the tag IGNIS uses, and bun and Node are exact', () => {
    expect(workflow).toMatch(/actions\/checkout@[0-9a-f]{40} # v6\.0\.3/);
    expect(workflow).toMatch(/actions\/setup-node@[0-9a-f]{40} # v6\.4\.0/);
    expect(workflow).toContain('bun-version: 1.4.4');
    expect(workflow).toContain('node-version: 24.22.1');
    expect(workflow).not.toContain('bun-version: latest');
    expect(workflow).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true');
  });

  test('the ARDOR-only steps stay: the preset, the version input, the catalog refresh', () => {
    expect(workflow).toContain('make preset-smoke');
    expect(workflow).toContain('scripts/release/release-plan.ts plan');
    expect(workflow).toContain('scripts/build/refresh-catalog.ts "$CATALOG_TAG"');
    expect(chainText).toContain('scripts/preset/vulcan-preset.ts');
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
  const workflow = workflowText;

  test('the heal step of the chain is given the published package, version and tag', () => {
    const heal = chainPlan.phaseB.find(
      (step) => step.label === 'kernel: keep next at or above latest',
    );

    expect(heal && 'command' in heal && heal.command).toEqual([
      'bun',
      'scripts/release/release-gates.ts',
      'heal-next',
      '--published',
      '@venizia/ardor-kernel@0.4.6-0',
      '--tag',
      'next',
    ]);
  });

  test('a heal_only dispatch runs only the heal job, on either branch; a release skips it (S4.5)', () => {
    expect(workflow).toMatch(/\n      heal_only:\n\s+type: boolean/);
    expect(workflow).toMatch(
      /\n  heal-next:\n\s+name: Heal next tags\n\s+if: \$\{\{ \(github.ref == 'refs\/heads\/develop' \|\| github.ref == 'refs\/heads\/main'\) && inputs.heal_only == true \}\}/,
    );
    expect(workflow).toMatch(
      /\n  plan:\n\s+name: Plan\n\s+if: \$\{\{ inputs.heal_only != true \}\}/,
    );
  });
});

// The release workflow and the chain are read as text, like the tests above. Each guard is a function of
// the two files; the real files satisfy every guard, and a copy with ONE guard removed fails exactly that
// one, so a guard that stops detecting anything cannot pass unnoticed. A pull request that removes a guard
// and its test together still passes: this stops accidents, not an author.
describe('package-release.yml and release-chain.ts guards, one mutation per guard', () => {
  interface IFiles {
    workflow: string;
    chain: string;
    presetSmoke: string;
  }

  const files: IFiles = {
    workflow: workflowText,
    chain: chainText,
    presetSmoke: readFileSync(join(ROOT, 'scripts/preset/preset-smoke.ts'), 'utf8'),
  };
  const vulcanPin: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    .devDependencies['@venizia/vulcan'];

  const headOf = (text: string): string => text.split(/\njobs:\n/)[0] ?? '';

  const MINIMUM_NPM = '11.21.0';
  const INSTALL_NPM_STEP = 'Install the npm that publishes';
  const RELEASE_STEP = 'Release the packages';
  const BRANCHES_MOVED_STEP = 'Refuse a stable when a branch moved since the plan';

  /** The publish condition of the workflow, evaluated: does the job run for these results? */
  const publishRuns = (opts: { plan: string; test: string; approve: string; kind: string }) =>
    opts.plan === 'success' &&
    opts.test === 'success' &&
    (opts.approve === 'success' || (opts.approve === 'skipped' && opts.kind === 'prerelease'));
  const PUBLISH_CASES: Array<[string, string, string, string, boolean]> = [
    ['success', 'success', 'skipped', 'prerelease', true],
    ['success', 'success', 'success', 'stable', true],
    ['success', 'success', 'skipped', 'stable', false],
    ['success', 'success', 'failure', 'stable', false],
    ['success', 'success', 'cancelled', 'stable', false],
    ['success', 'failure', 'skipped', 'prerelease', false],
    ['failure', 'success', 'skipped', 'prerelease', false],
  ];
  const REPORT_STEP = 'Report the run';
  const GITHUB_RELEASE_STEP = 'Create the GitHub Release';
  const LOOP = 'for package in ${PACKAGES//,/ }; do';

  const guards = {
    // S4.5, C3.5: a heal runs on develop or main and nowhere else; a release is planned unless it is a heal.
    healBranches: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);

      return (
        /\n {4}if: .*github\.ref == 'refs\/heads\/develop'.*github\.ref == 'refs\/heads\/main'.*inputs\.heal_only == true/.test(
          jobs['heal-next'] ?? '',
        ) && /\n {4}if: \$\{\{ inputs\.heal_only != true \}\}\n/.test(jobs.plan ?? '')
      );
    },
    // C2: read-only by default; only the publish job writes.
    minimalPermissions: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);

      return (
        /\npermissions:\n {2}contents: read\n/.test(headOf(workflow)) &&
        /\n {4}permissions:\n {6}contents: write\n/.test(jobs.publish ?? '') &&
        ['plan', 'test', 'approve', 'heal-next'].every(
          (name) => !(jobs[name] ?? '').includes('contents: write'),
        )
      );
    },
    // C2.2-b, C3: test, approve and publish each need the plan; publish needs all three; the test job has no secret.
    jobGraph: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);

      return (
        /\n {4}needs: plan\n/.test(jobs.test ?? '') &&
        /\n {4}needs: \[plan, test\]\n/.test(jobs.approve ?? '') &&
        /\n {4}needs: \[plan, test, approve\]\n/.test(jobs.publish ?? '') &&
        (jobs.test ?? '').length > 0 &&
        !(jobs.test ?? '').includes('secrets.') &&
        !(jobs.test ?? '').includes('contents: write')
      );
    },
    // C3.5-a, C25: the approval is one job, for a stable only, with the environment release-approval and no
    // permission; nothing else names that environment, and nothing waits after the publish.
    approveOnce: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);
      const approve = jobs.approve ?? '';
      const naming = Object.entries(jobs).filter(([, job]) =>
        withoutComments(job).includes('release-approval'),
      );

      return (
        /\n {4}environment: release-approval\n/.test(approve) &&
        /\n {4}permissions: \{\}\n/.test(approve) &&
        /\n {4}if: \$\{\{ needs\.plan\.outputs\.kind == 'stable' \}\}\n/.test(approve) &&
        naming.length === 1 &&
        naming[0]?.[0] === 'approve' &&
        !withoutComments(jobs.publish ?? '').includes('release-approval')
      );
    },
    // C3.7, C26: the publish condition is written out, and its truth table holds.
    publishCondition: ({ workflow }: IFiles): boolean => {
      const condition = (jobsOf(workflow).publish ?? '').match(
        /\n {4}if: >-\n((?: {6}[^\n]*\n)+)/,
      )?.[1];

      if (condition === undefined) {
        return false;
      }

      const expected =
        "${{ !cancelled() && needs.plan.result == 'success' && needs.test.result == 'success' && (needs.approve.result == 'success' || (needs.approve.result == 'skipped' && needs.plan.outputs.kind == 'prerelease')) }}";

      return (
        condition.trim().split(/\s+/).join(' ') === expected &&
        PUBLISH_CASES.every(
          ([plan, test, approve, kind, runs]) =>
            publishRuns({ plan, test, approve, kind }) === runs,
        )
      );
    },
    // C3.3c, C27: a stable checks, before the version work and the publish, that main and develop are where the plan saw them.
    branchMoved: ({ workflow }: IFiles): boolean => {
      const steps = stepsOf(jobsOf(workflow).publish ?? '');
      const names = steps.map((step) => step.name);
      const guard = steps.find((step) => step.name === BRANCHES_MOVED_STEP)?.text ?? '';

      return (
        guard.includes("if: ${{ needs.plan.outputs.kind == 'stable' }}") &&
        guard.includes('git rev-parse origin/main') &&
        guard.includes('"$GITHUB_SHA"') &&
        guard.includes('git rev-parse origin/develop') &&
        guard.includes('"$PLAN_DEVELOP_SHA"') &&
        names.indexOf(BRANCHES_MOVED_STEP) > -1 &&
        names.indexOf(BRANCHES_MOVED_STEP) < names.indexOf(INSTALL_NPM_STEP) &&
        names.indexOf(BRANCHES_MOVED_STEP) < names.indexOf(RELEASE_STEP)
      );
    },
    // C3.3a, C30: the plan job tries the merge back of a stable and hands develop's head on.
    planTrial: ({ workflow }: IFiles): boolean => {
      const plan = jobsOf(workflow).plan ?? '';

      return (
        /release-plan\.ts plan .*--merge-trial/.test(plan) &&
        /\n {6}develop_sha: \$\{\{ steps\.plan\.outputs\.develop_sha \}\}/.test(plan) &&
        /fetch-depth: 0/.test(plan)
      );
    },
    // S4.6: the publish job takes the plan's version and kind, never works them out, and passes them to the chain.
    publishUsesThePlan: ({ workflow }: IFiles): boolean => {
      const publish = jobsOf(workflow).publish ?? '';
      const release = stepsOf(publish).find((step) => step.name === RELEASE_STEP)?.text ?? '';

      return (
        publish.includes('PLAN_VERSION: ${{ needs.plan.outputs.version }}') &&
        publish.includes('PLAN_KIND: ${{ needs.plan.outputs.kind }}') &&
        release.includes('--version "$PLAN_VERSION"') &&
        release.includes('--plan-version "$PLAN_VERSION"') &&
        release.includes('--plan-kind "$PLAN_KIND"') &&
        release.includes('--target-branch "$GITHUB_REF_NAME"') &&
        !publish.includes('release-plan.ts') &&
        !publish.includes('RELEASE_VERSION')
      );
    },
    // C34 (VULCAN's C31): the publish job makes the GitHub Release after the chain and cannot fail the run for it.
    githubRelease: ({ workflow }: IFiles): boolean => {
      const publish = jobsOf(workflow).publish ?? '';
      const steps = stepsOf(publish);
      const names = steps.map((step) => step.name);
      const release = steps.find((step) => step.name === GITHUB_RELEASE_STEP)?.text ?? '';

      return (
        names.indexOf(GITHUB_RELEASE_STEP) > names.indexOf(RELEASE_STEP) &&
        names.indexOf(RELEASE_STEP) > -1 &&
        names.indexOf(GITHUB_RELEASE_STEP) < names.indexOf(REPORT_STEP) &&
        /\n {8}if: \$\{\{ !cancelled\(\) \}\}\n/.test(release) &&
        /\n {8}continue-on-error: true\n/.test(release) &&
        /\n {8}timeout-minutes: 5\n/.test(release) &&
        /\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/.test(release) &&
        /\n {8}run: bun scripts\/release\/github-release\.ts create --version "\$PLAN_VERSION" --kind "\$PLAN_KIND" --packages "\$PACKAGES"\n/.test(
          release,
        ) &&
        // The job token is the only credential: no secret, and no other step holds a GitHub token.
        !/secrets\./.test(release) &&
        steps.filter((step) => /GH_TOKEN/.test(step.text)).length === 1
      );
    },
    // S4.3: a stable builds on IGNIS latest and a prerelease on the highest line: the test and publish jobs read the plan's tag.
    catalogTagFromPlan: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);

      return ['test', 'publish'].every((name) => {
        const job = jobs[name] ?? '';

        return (
          job.includes('CATALOG_TAG: ${{ needs.plan.outputs.catalog_tag }}') &&
          job.includes('refresh-catalog.ts "$CATALOG_TAG"') &&
          job.includes('force-update "$CATALOG_TAG"') &&
          !job.includes('refresh-catalog.ts highest')
        );
      });
    },
    // C29: nothing force-pushes, moves or deletes a tag, or deletes a branch, in the workflow or the chain.
    noDestructiveGit: ({ workflow, chain }: IFiles): boolean =>
      !/--force|--delete|push [^\n]*(?: |')\+|push origin :|'push', 'origin', ':|git tag -[fd]\b|'tag', '-[fd]'|branch -[dD]\b/.test(
        withoutComments(`${workflow}\n${chain}`),
      ),
    // C28: the merge back runs from a copy of this checkout's script on a worktree of develop; the checkout never moves to develop.
    mergeBackFromCopy: ({ workflow, chain }: IFiles): boolean => {
      const code = withoutComments(chain);

      return (
        code.includes("'cp', 'scripts/release/merge-back.ts'") &&
        code.includes("'worktree', 'add', '--detach'") &&
        code.includes("'apply', '--from'") &&
        code.includes("'--repo'") &&
        !/git (?:checkout|switch) develop|'(?:checkout|switch)', 'develop'/.test(
          withoutComments(`${workflow}\n${chain}`),
        )
      );
    },
    // C5: an exact bun in every setup.
    exactBun: ({ workflow }: IFiles): boolean => {
      const versions = [...workflow.matchAll(/bun-version: (.+)/g)].map((match) => match[1] ?? '');

      return versions.length >= 3 && versions.every((version) => /^\d+\.\d+\.\d+$/.test(version));
    },
    // C5, C23: an exact Node without a cache in every setup, and where npm talks to the registry an
    // exact npm of at least 11.21.0 (the first that moves a dist-tag over OIDC), asserted.
    exactNodeAndNpm: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);
      const nodes = [...workflow.matchAll(/node-version: (.+)/g)].map((match) => match[1] ?? '');
      const caches = [...workflow.matchAll(/package-manager-cache: (.+)/g)].map(
        (match) => match[1] ?? '',
      );
      const npmIsPinned = ['publish', 'heal-next'].every((name) => {
        const run = stepsOf(jobs[name] ?? '').find((step) => step.name === INSTALL_NPM_STEP)?.text;
        const version = run?.match(/npm install --global npm@(\d+\.\d+\.\d+)(?:\s|$)/)?.[1];

        return (
          version !== undefined &&
          Bun.semver.order(version, MINIMUM_NPM) >= 0 &&
          run?.includes('npm --version') === true
        );
      });

      return (
        nodes.length >= 3 &&
        nodes.every((version) => /^\d+\.\d+\.\d+$/.test(version)) &&
        caches.length === nodes.length &&
        caches.every((value) => value === 'false') &&
        npmIsPinned
      );
    },
    // C6: no npm token in any form and no secret at all, in the workflow or the chain: the release
    // publishes through trusted publishing.
    noNpmToken: ({ workflow, chain }: IFiles): boolean =>
      !/secrets\.|NPM_ACCESS_TOKEN|NPM_CONFIG_TOKEN|NODE_AUTH_TOKEN/.test(
        withoutComments(`${workflow}\n${chain}`),
      ),
    // C16: the jobs that talk to npm name the environment npm-release; the test job names none.
    publishEnvironment: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);

      return (
        ['publish', 'heal-next'].every((name) =>
          /\n {4}environment: npm-release\n/.test(jobs[name] ?? ''),
        ) &&
        !(jobs.test ?? '').includes('environment:') &&
        !(jobs.plan ?? '').includes('environment:')
      );
    },
    // C20: id-token: write is what trusted publishing signs with: on the jobs that talk to npm, nowhere else.
    idTokenOnPublishJobs: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);

      return (
        ['publish', 'heal-next'].every((name) =>
          /\n {4}permissions:\n(?: {6}[\w-]+: \w+\n)* {6}id-token: write\n/.test(jobs[name] ?? ''),
        ) &&
        !withoutComments(headOf(workflow)).includes('id-token') &&
        ['plan', 'test', 'approve'].every(
          (name) => !withoutComments(jobs[name] ?? '').includes('id-token'),
        )
      );
    },
    // C21: the workflow runs the chain, and the chain publishes the tarball bun packed, with npm and a
    // provenance; bun publish is gone.
    provenancePublish: ({ workflow, chain }: IFiles): boolean =>
      isTrustedPublishWorkflow({ workflow, chain }) &&
      !/\bbun publish\b|'bun',\s*'publish'/.test(withoutComments(`${workflow}\n${chain}`)),
    // C23: the npm that is installed and asserted comes before the first step that uses npm to talk to the registry.
    npmInstalledBeforeUse: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);
      const firstUse: Record<string, string> = {
        publish: RELEASE_STEP,
        'heal-next': 'Move next to latest where it is below',
      };

      return Object.entries(firstUse).every(([job, use]) => {
        const names = stepsOf(jobs[job] ?? '').map((step) => step.name);

        return (
          names.indexOf(INSTALL_NPM_STEP) > -1 &&
          names.indexOf(INSTALL_NPM_STEP) < names.indexOf(use)
        );
      });
    },
    // C24: the tarball that was packed and checked is the tarball that is published: its checksum is
    // recorded, then checked, before the publish, and the check compares against the record.
    tarballChecksum: ({ chain }: IFiles): boolean => {
      const body = chain.slice(chain.indexOf('static release('));
      const record = body.indexOf("kind: 'record-sha'");
      const verify = body.indexOf("kind: 'verify-sha'");
      const publish = body.indexOf("kind: 'publish'");

      return (
        record > -1 && record < verify && verify < publish && chain.includes('now === state?.sha')
      );
    },
    // C17: every checkout is the dispatched commit; no step moves to a branch; the run name carries it.
    dispatchedCommit: ({ workflow }: IFiles): boolean => {
      const jobs = jobsOf(workflow);
      const checkouts = Object.values(jobs).flatMap((job) =>
        stepsOf(job).filter((step) => step.text.includes('uses: actions/checkout@')),
      );
      const runName = workflow.match(/^run-name: (.+)$/m)?.[1] ?? '';

      // The title carries the verified label first and the whole commit when there is none: the whole
      // expression is pinned, not a substring, so `inputs.label` cannot be dropped or reordered away.
      return (
        checkouts.length >= 3 &&
        checkouts.every((step) => /\n {10}ref: \$\{\{ github\.sha \}\}/.test(step.text)) &&
        !/git checkout develop|git pull origin develop|git switch develop/.test(workflow) &&
        /^"Release · \$\{\{ inputs\.heal_only && .*github\.sha\) \|\| inputs\.label \|\| format\(.*, github\.sha\) \}\}"$/.test(
          runName,
        )
      );
    },
    // C33: the title is the dispatcher's `label` input, and the plan job (not the title) decides whether it is true:
    // the plan is handed the label through the step env, never through the script text, and it is the last flag.
    labelVerified: ({ workflow }: IFiles): boolean => {
      const plan = jobsOf(workflow).plan ?? '';
      const planStep = stepsOf(plan).find((step) => step.name === 'Plan the run')?.text ?? '';
      const input =
        workflow
          .split(/\njobs:\n/)[0]
          ?.match(/\n {6}label:\n([\s\S]*?)(?=\n {6}\w+:\n|\n\S)/)?.[1] ?? '';

      return (
        /type: string/.test(input) &&
        /default: ''/.test(input) &&
        /\n {10}RELEASE_LABEL: \$\{\{ inputs\.label \}\}\n/.test(planStep) &&
        /\n {8}run: bun scripts\/release\/release-plan\.ts plan .* --label "\$RELEASE_LABEL"\n/.test(
          planStep,
        ) &&
        // The label is read in two places and nowhere else in the file: the title, and the env of the plan step.
        !/inputs\.label/.test(
          workflow
            .replace(/^run-name: .*$/m, '')
            .replace(/\n {10}RELEASE_LABEL: \$\{\{ inputs\.label \}\}\n/, '\n'),
        ) &&
        // A plan step that may fail without failing the job would let a refused label through.
        !/continue-on-error/.test(plan)
      );
    },
    // D6: every action by its full commit, with the tag in a comment.
    actionsByCommit: ({ workflow }: IFiles): boolean => {
      const uses = [...workflow.matchAll(/^\s+uses: (.+)$/gm)].map((match) => match[1] ?? '');

      return (
        uses.length >= 9 &&
        uses.every((value) => /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/.test(value))
      );
    },
    // C4: preset-smoke runs the VULCAN the repository pins, and `latest` appears nowhere.
    pinnedVulcan: ({ workflow, presetSmoke }: IFiles): boolean =>
      workflow.match(/VULCAN_CMD: bun x @venizia\/vulcan@(\S+)/)?.[1] === vulcanPin &&
      !/@latest|bun-version: latest/.test(workflow) &&
      !presetSmoke.includes('@venizia/vulcan@latest'),
    // C1.5b: one run for the packages it names: a `packages` input, no per-package input, no chain input.
    oneRun: ({ workflow }: IFiles): boolean =>
      /\n {6}packages:\n {8}type: string\n/.test(workflow) &&
      !/\n {6}package:\n/.test(workflow) &&
      !workflow.includes('chain_released'),
    // S1b.5: the test job loops each gate over the packages of the run, runs no clean-install, and the
    // preset smoke runs when the run holds ardor.
    testJobLoops: ({ workflow }: IFiles): boolean => {
      const testJob = jobsOf(workflow).test ?? '';
      const steps = stepsOf(testJob);
      const looped = [
        'Assert internal dependencies link to the workspace',
        'Build',
        'Lint',
        'Test the package',
        'Purity gate',
      ];
      const smoke = steps.find((step) => step.name === 'VULCAN preset smoke')?.text ?? '';

      return (
        !testJob.includes('clean-install') &&
        looped.every(
          (name) => steps.find((step) => step.name === name)?.text.includes(LOOP) === true,
        ) &&
        /\n {8}if: .*',ardor,'/.test(smoke)
      );
    },
    // #434: one copy of every @venizia package is checked in the test job, after the install and before the build,
    // so a stable IGNIS copy next to a prerelease is named before it surfaces as a type error.
    oneCopy: ({ workflow }: IFiles): boolean => {
      const names = stepsOf(jobsOf(workflow).test ?? '').map((step) => step.name);
      const step = stepsOf(jobsOf(workflow).test ?? '').find(
        (candidate) => candidate.name === 'Assert one copy of every @venizia package',
      );

      return (
        step?.text.includes('bun scripts/release/release-gates.ts single-copy') === true &&
        names.indexOf('Install') < names.indexOf('Assert one copy of every @venizia package') &&
        names.indexOf('Assert one copy of every @venizia package') < names.indexOf('Build')
      );
    },
    // S1b.3: the release job ends with a report that runs even when the job is cancelled or times out.
    reportAlways: ({ workflow }: IFiles): boolean => {
      const steps = stepsOf(jobsOf(workflow).publish ?? '');
      const last = steps[steps.length - 1];

      return (
        last?.name === REPORT_STEP &&
        /\n {8}if: \$\{\{ always\(\) \}\}\n/.test(last.text) &&
        /release-chain\.ts report --state/.test(last.text)
      );
    },
    // S1b.12: the chain never pulls, rebases or force-pushes: a rejected push stops the run.
    chainNeverRebases: ({ chain }: IFiles): boolean =>
      !/--force|reset --hard|'pull'|'rebase'|'--rebase'/.test(withoutComments(chain)),
  };

  type TGuard = keyof typeof guards;

  const mutations: Array<{
    guard: TGuard;
    name: string;
    file?: keyof IFiles;
    mutate: (text: string) => string;
  }> = [
    {
      guard: 'healBranches',
      name: 'the heal job loses the branch condition',
      mutate: (text) =>
        text.replace(
          "(github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main') && inputs.heal_only == true",
          'inputs.heal_only == true',
        ),
    },
    {
      guard: 'healBranches',
      name: 'the heal job no longer covers main',
      mutate: (text) => text.replace(" || github.ref == 'refs/heads/main'", ''),
    },
    {
      guard: 'healBranches',
      name: 'the plan runs for a heal',
      mutate: (text) => text.replace('    if: ${{ inputs.heal_only != true }}\n', ''),
    },
    {
      guard: 'minimalPermissions',
      name: 'the workflow default is write',
      mutate: (text) =>
        text.replace('\npermissions:\n  contents: read\n', '\npermissions:\n  contents: write\n'),
    },
    {
      guard: 'minimalPermissions',
      name: 'the publish job loses its write grant',
      mutate: (text) => text.replace('    permissions:\n      contents: write\n', ''),
    },
    {
      guard: 'minimalPermissions',
      name: 'the plan job can write',
      mutate: (text) =>
        text.replace(
          '    permissions:\n      contents: read\n    outputs:',
          '    permissions:\n      contents: write\n    outputs:',
        ),
    },
    {
      guard: 'jobGraph',
      name: 'the publish job no longer needs the approval',
      mutate: (text) => text.replace('needs: [plan, test, approve]', 'needs: [plan, test]'),
    },
    {
      guard: 'jobGraph',
      name: 'the test job no longer needs the plan',
      mutate: (text) => text.replace('    needs: plan\n', ''),
    },
    {
      guard: 'jobGraph',
      name: 'the approval no longer waits for the gates',
      mutate: (text) => text.replace('    needs: [plan, test]\n', '    needs: [plan]\n'),
    },
    {
      guard: 'jobGraph',
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
      guard: 'noNpmToken',
      name: 'a plan step reads the old credential',
      mutate: (text) =>
        text.replace(
          '      - name: Plan the run\n',
          '      - name: Plan the run\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}\n',
        ),
    },
    {
      guard: 'approveOnce',
      name: 'the approval runs for a prerelease too',
      mutate: (text) =>
        text.replace(
          "    if: ${{ needs.plan.outputs.kind == 'stable' }}\n    environment: release-approval",
          '    environment: release-approval',
        ),
    },
    {
      guard: 'approveOnce',
      name: 'the approval job loses its environment',
      mutate: (text) => text.replace('    environment: release-approval\n', ''),
    },
    {
      guard: 'approveOnce',
      name: 'the approval job gains a permission',
      mutate: (text) =>
        text.replace('    permissions: {}\n', '    permissions:\n      contents: read\n'),
    },
    {
      guard: 'approveOnce',
      name: 'the publish job asks for the approval environment as well',
      mutate: (text) =>
        text.replace(
          '    environment: npm-release\n    env:\n      PLAN_VERSION',
          '    environment: release-approval\n    env:\n      PLAN_VERSION',
        ),
    },
    {
      guard: 'publishCondition',
      name: 'a skipped approval lets a stable publish',
      mutate: (text) => text.replace(" && needs.plan.outputs.kind == 'prerelease'", ''),
    },
    {
      guard: 'publishCondition',
      name: 'the publish ignores a failed gate',
      mutate: (text) => text.replace(" && needs.test.result == 'success'", ''),
    },
    {
      guard: 'publishCondition',
      name: 'the publish runs after a cancel',
      mutate: (text) => text.replace('!cancelled() && ', ''),
    },
    {
      guard: 'branchMoved',
      name: 'the branch check no longer compares main with the dispatched commit',
      mutate: (text) => text.replace('"$(git rev-parse origin/main)" != "$GITHUB_SHA"', 'true'),
    },
    {
      guard: 'branchMoved',
      name: 'the branch check no longer compares develop with the plan',
      mutate: (text) => text.replace('"$PLAN_DEVELOP_SHA"', 'true'),
    },
    {
      guard: 'branchMoved',
      name: 'the branch check runs after the npm install',
      mutate: (text) => text.replace(BRANCHES_MOVED_STEP, 'Check the branches late'),
    },
    {
      guard: 'planTrial',
      name: 'the plan stops trying the merge back',
      mutate: (text) => text.replace(' --merge-trial', ''),
    },
    {
      guard: 'planTrial',
      name: 'the plan stops handing develop on',
      mutate: (text) =>
        text.replace('      develop_sha: ${{ steps.plan.outputs.develop_sha }}\n', ''),
    },
    {
      guard: 'githubRelease',
      name: 'the step may fail the run',
      mutate: (text) =>
        text.replace('        continue-on-error: true\n        timeout-minutes: 5\n', ''),
    },
    {
      guard: 'githubRelease',
      name: 'the step is not bounded in time',
      mutate: (text) => text.replace('        timeout-minutes: 5\n', ''),
    },
    {
      guard: 'githubRelease',
      name: 'the step comes before the chain',
      mutate: (text) => {
        const block =
          /( {6}- name: Create the GitHub Release\n[\s\S]*?)(?= {6}# A job that was cancelled)/.exec(
            text,
          )?.[1];

        return block === undefined
          ? text
          : text
              .replace(block, '')
              .replace(
                '      - name: Release the packages\n',
                `${block}      - name: Release the packages\n`,
              );
      },
    },
    {
      guard: 'githubRelease',
      name: 'the step stops running after a failed chain',
      mutate: (text) =>
        text.replace(
          '      - name: Create the GitHub Release\n        if: ${{ !cancelled() }}\n',
          '      - name: Create the GitHub Release\n',
        ),
    },
    {
      guard: 'githubRelease',
      name: 'the step uses a secret instead of the job token',
      mutate: (text) =>
        text.replace('GH_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ secrets.GITHUB_PAT }}'),
    },
    {
      guard: 'githubRelease',
      name: 'the step is not told the packages of the run',
      mutate: (text) =>
        text.replace(
          ' --packages "$PACKAGES"\n\n      # A job that was cancelled',
          '\n\n      # A job that was cancelled',
        ),
    },
    {
      guard: 'githubRelease',
      name: 'the step is gone',
      mutate: (text) =>
        text.replace(
          / {6}- name: Create the GitHub Release\n[\s\S]*?(?= {6}# A job that was cancelled)/,
          '',
        ),
    },
    {
      guard: 'publishUsesThePlan',
      name: 'the chain is given another version',
      mutate: (text) => text.replace('--version "$PLAN_VERSION"', '--version "$VERSION"'),
    },
    {
      guard: 'publishUsesThePlan',
      name: 'the chain is not told the plan',
      mutate: (text) => text.replace(' --plan-kind "$PLAN_KIND"', ''),
    },
    {
      guard: 'publishUsesThePlan',
      name: 'the chain is not told the branch',
      mutate: (text) => text.replace(' --target-branch "$GITHUB_REF_NAME"', ''),
    },
    {
      guard: 'catalogTagFromPlan',
      name: 'the publish refreshes the catalog on the highest line again',
      mutate: (text) =>
        text.replace(
          /bun scripts\/build\/refresh-catalog\.ts "\$CATALOG_TAG"/g,
          'bun scripts/build/refresh-catalog.ts highest',
        ),
    },
    {
      guard: 'catalogTagFromPlan',
      name: 'the test job stops reading the plan tag',
      mutate: (text) =>
        text.replace('    env:\n      CATALOG_TAG: ${{ needs.plan.outputs.catalog_tag }}\n', ''),
    },
    {
      guard: 'noDestructiveGit',
      name: 'a push is forced',
      file: 'chain',
      mutate: (text) =>
        text.replace(
          "'push', 'origin', `HEAD:${targetBranch}`",
          "'push', '--force', 'origin', `HEAD:${targetBranch}`",
        ),
    },
    {
      guard: 'noDestructiveGit',
      name: 'a tag is replaced',
      file: 'chain',
      mutate: (text) =>
        text.replace(
          "command: ['git', 'tag', '-a', tag",
          "command: ['git', 'tag', '-f', '-a', tag",
        ),
    },
    {
      guard: 'noDestructiveGit',
      name: 'a branch is deleted by the workflow',
      mutate: (text) =>
        text.replace(
          '      - name: Release the packages\n',
          '      - name: Clean up\n        run: git push origin --delete release-old\n\n      - name: Release the packages\n',
        ),
    },
    {
      guard: 'mergeBackFromCopy',
      name: 'the merge back runs the script of the checkout in place',
      file: 'chain',
      mutate: (text) =>
        text.replace("copy: ['cp', 'scripts/release/merge-back.ts', script],", "copy: ['true'],"),
    },
    {
      guard: 'mergeBackFromCopy',
      name: 'the workflow moves the checkout to develop',
      mutate: (text) =>
        text.replace(
          '      - name: Release the packages\n',
          '      - name: Move\n        run: git checkout develop\n\n      - name: Release the packages\n',
        ),
    },
    {
      guard: 'noNpmToken',
      name: 'the heal step reads the old credential',
      mutate: (text) =>
        text.replace(
          '        run: bun scripts/release/release-gates.ts heal-next\n',
          '        run: bun scripts/release/release-gates.ts heal-next\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}\n',
        ),
    },
    {
      guard: 'noNpmToken',
      name: 'the chain gives the publish a token again',
      file: 'chain',
      mutate: (text) =>
        text.replace(
          "          'npm',\n          'publish',",
          "          'env',\n          'NPM_CONFIG_TOKEN=abc',\n          'npm',\n          'publish',",
        ),
    },
    {
      guard: 'publishEnvironment',
      name: 'the publish job loses the environment',
      mutate: (text) => text.replace('    environment: npm-release\n', ''),
    },
    {
      guard: 'publishEnvironment',
      name: 'the heal job loses the environment',
      mutate: (text) =>
        text.replace(/(\n {2}heal-next:[\s\S]*?)\n {4}environment: npm-release\n/, '$1\n'),
    },
    {
      guard: 'publishEnvironment',
      name: 'the test job joins the environment',
      mutate: (text) =>
        text.replace(
          '    needs: plan\n    runs-on: ubuntu-26.04\n',
          '    needs: plan\n    runs-on: ubuntu-26.04\n    environment: npm-release\n',
        ),
    },
    {
      guard: 'idTokenOnPublishJobs',
      name: 'the publish job loses id-token',
      mutate: (text) => text.replace('      id-token: write\n', ''),
    },
    {
      guard: 'idTokenOnPublishJobs',
      name: 'the heal job loses id-token',
      mutate: (text) => text.replace(/(\n {2}heal-next:[\s\S]*?)\n {6}id-token: write\n/, '$1\n'),
    },
    {
      guard: 'idTokenOnPublishJobs',
      name: 'the workflow default grants id-token',
      mutate: (text) =>
        text.replace(
          '\npermissions:\n  contents: read\n',
          '\npermissions:\n  contents: read\n  id-token: write\n',
        ),
    },
    {
      guard: 'provenancePublish',
      name: 'the publish drops the provenance',
      file: 'chain',
      mutate: (text) => text.replace("          '--provenance',\n", ''),
    },
    {
      guard: 'provenancePublish',
      name: 'the publish is bun publish again',
      file: 'chain',
      mutate: (text) =>
        text.replace(
          "          'npm',\n          'publish',",
          "          'bun',\n          'publish',",
        ),
    },
    {
      guard: 'provenancePublish',
      name: 'the tarball is no longer packed by bun',
      file: 'chain',
      mutate: (text) =>
        text.replace(
          "command: ['bun', 'pm', 'pack', '--quiet', '--filename', tarball]",
          "command: ['npm', 'pack', '--quiet', '--filename', tarball]",
        ),
    },
    {
      guard: 'provenancePublish',
      name: 'the workflow stops running the chain',
      mutate: (text) => text.replace('bun scripts/release/release-chain.ts "${ARGS[@]}"', 'true'),
    },
    {
      guard: 'npmInstalledBeforeUse',
      name: 'the publish job installs npm after the release step',
      mutate: (text) => {
        const block =
          /      # Trusted publishing needs npm[^\n]*\n      # that ships[^\n]*\n      - name: Install the npm that publishes\n        run: \|\n(?: {10}[^\n]*\n)+/.exec(
            text,
          )?.[0] ?? '';

        return text
          .replace(block, '')
          .replace(
            '      # A job that was cancelled or timed out',
            `${block}\n      # A job that was cancelled or timed out`,
          );
      },
    },
    {
      guard: 'npmInstalledBeforeUse',
      name: 'the heal job installs npm after the heal',
      mutate: (text) => {
        const block =
          /      - name: Install the npm that publishes\n        run: \|\n(?: {10}[^\n]*\n)+\n(?=      - name: Move next)/.exec(
            text.slice(text.indexOf('\n  heal-next:')),
          )?.[0] ?? '';
        const healAt = text.indexOf('\n  heal-next:');
        const head = text.slice(0, healAt);
        const heal = text.slice(healAt).replace(block, '');

        return `${head}${heal.trimEnd()}\n\n${block.trimEnd()}\n`;
      },
    },
    {
      guard: 'tarballChecksum',
      name: 'the chain stops checking the checksum',
      file: 'chain',
      mutate: (text) => text.replace("{ kind: 'verify-sha',", "{ kind: 'skip-sha',"),
    },
    {
      guard: 'tarballChecksum',
      name: 'the chain stops recording the checksum',
      file: 'chain',
      mutate: (text) => text.replace("{ kind: 'record-sha',", "{ kind: 'skip-record',"),
    },
    {
      guard: 'tarballChecksum',
      name: 'the check no longer compares against the record',
      file: 'chain',
      mutate: (text) => text.replace('now === state?.sha', 'true'),
    },
    {
      guard: 'exactNodeAndNpm',
      name: 'Node is a range',
      mutate: (text) => text.replace('node-version: 24.22.1', "node-version: '24'"),
    },
    {
      guard: 'exactNodeAndNpm',
      name: 'a Node setup caches',
      mutate: (text) => text.replace('package-manager-cache: false', 'package-manager-cache: true'),
    },
    {
      guard: 'exactNodeAndNpm',
      name: 'npm is not pinned',
      mutate: (text) => text.replace('npm@11.21.1', 'npm@latest'),
    },
    {
      guard: 'exactNodeAndNpm',
      name: 'npm is below the first that moves a dist-tag over OIDC',
      mutate: (text) => text.replace(/npm@11\.21\.1 /g, 'npm@11.20.0 '),
    },
    {
      guard: 'exactNodeAndNpm',
      name: 'the npm version is no longer asserted',
      mutate: (text) => text.replace(/npm --version/g, 'true'),
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
          '      - name: Release the packages\n',
          '      - name: Sync develop\n        run: git fetch origin && git checkout develop && git pull origin develop\n\n      - name: Release the packages\n',
        ),
    },
    {
      guard: 'dispatchedCommit',
      name: 'the run name drops the commit',
      mutate: (text) => text.replace(/, github\.sha\) \}\}"$/m, ') }}"'),
    },
    {
      guard: 'dispatchedCommit',
      name: 'the run name drops the label',
      mutate: (text) => text.replace(' || inputs.label ||', ' ||'),
    },
    {
      guard: 'dispatchedCommit',
      name: 'the run name is the old NPM Release one',
      mutate: (text) =>
        text.replace(
          /^run-name: .*$/m,
          "run-name: \"${{ inputs.heal_only && 'heal the next tags' || format('packages: {0}', inputs.packages) }} | ${{ github.sha }}\"",
        ),
    },
    {
      guard: 'labelVerified',
      name: 'the plan no longer gets the label',
      mutate: (text) => text.replace(' --label "$RELEASE_LABEL"', ''),
    },
    {
      guard: 'labelVerified',
      name: 'the label is written into the script text',
      mutate: (text) => text.replace('--label "$RELEASE_LABEL"', '--label "${{ inputs.label }}"'),
    },
    {
      guard: 'labelVerified',
      name: 'the label input is gone',
      mutate: (text) => text.replace(/\n {6}label:\n[\s\S]*?(?=\n {6}heal_only:\n)/, ''),
    },
    {
      guard: 'labelVerified',
      name: 'an extra step of the plan job writes the label into a script',
      mutate: (text) =>
        text.replace(
          '      - name: Plan the run\n',
          '      - name: Show the label\n        run: echo "${{ inputs.label }}"\n\n      - name: Plan the run\n',
        ),
    },
    {
      guard: 'labelVerified',
      name: 'the workflow reads the label in its top-level env',
      mutate: (text) =>
        text.replace(
          'env:\n  FORCE_JAVASCRIPT',
          'env:\n  TITLE: ${{ inputs.label }}\n  FORCE_JAVASCRIPT',
        ),
    },
    {
      guard: 'labelVerified',
      name: 'the plan step may fail without failing the job',
      mutate: (text) =>
        text.replace(
          '      - name: Plan the run\n        id: plan\n',
          '      - name: Plan the run\n        id: plan\n        continue-on-error: true\n',
        ),
    },
    {
      guard: 'labelVerified',
      name: 'another job reads the label',
      mutate: (text) =>
        text.replace(
          '    needs: plan\n    runs-on: ubuntu-26.04\n',
          '    needs: plan\n    runs-on: ubuntu-26.04\n    env:\n      TITLE: ${{ inputs.label }}\n',
        ),
    },
    {
      guard: 'actionsByCommit',
      name: 'an action goes back to a tag',
      mutate: (text) =>
        text.replace(/actions\/checkout@[0-9a-f]{40} # v6\.0\.3/, 'actions/checkout@v6.0.3'),
    },
    {
      guard: 'oneRun',
      name: 'the chain_released input is back',
      mutate: (text) =>
        text.replace(
          '      heal_only:\n',
          '      chain_released:\n        type: string\n      heal_only:\n',
        ),
    },
    {
      guard: 'oneRun',
      name: 'the per-package input is back',
      mutate: (text) =>
        text.replace(
          '      packages:\n',
          '      package:\n        type: string\n      packages:\n',
        ),
    },
    {
      guard: 'oneRun',
      name: 'the packages input is gone',
      mutate: (text) =>
        text.replace(
          '      packages:\n        type: string\n',
          '      other:\n        type: string\n',
        ),
    },
    {
      guard: 'oneCopy',
      name: 'the copies gate runs after the build',
      mutate: (text) =>
        text
          .replace(
            '      - name: Assert one copy of every @venizia package\n        run: bun scripts/release/release-gates.ts single-copy\n',
            '',
          )
          .replace(
            '      - name: Lint\n',
            '      - name: Assert one copy of every @venizia package\n        run: bun scripts/release/release-gates.ts single-copy\n\n      - name: Lint\n',
          ),
    },
    {
      guard: 'oneCopy',
      name: 'the copies gate is removed',
      mutate: (text) =>
        text.replace(
          '      - name: Assert one copy of every @venizia package\n        run: bun scripts/release/release-gates.ts single-copy\n',
          '',
        ),
    },
    {
      guard: 'testJobLoops',
      name: 'a gate of the test job names one package',
      mutate: (text) =>
        text.replace(
          'for package in ${PACKAGES//,/ }; do\n            make "lint-$package"',
          'for package in kernel; do\n            make "lint-$package"',
        ),
    },
    {
      guard: 'testJobLoops',
      name: 'the test job runs clean-install again',
      mutate: (text) =>
        text.replace(
          '      - name: Check dependency catalog\n',
          '      - name: Clean-install gate\n        run: make clean-install-kernel\n\n      - name: Check dependency catalog\n',
        ),
    },
    {
      guard: 'testJobLoops',
      name: 'the preset smoke runs without ardor in the run',
      mutate: (text) => text.replace(/\n {8}if: \$\{\{ contains\(format\([^\n]*\n/, '\n'),
    },
    {
      guard: 'reportAlways',
      name: 'the report step loses its always()',
      mutate: (text) => text.replace('        if: ${{ always() }}\n', ''),
    },
    {
      guard: 'reportAlways',
      name: 'the report step prints nothing of the chain',
      mutate: (text) =>
        text.replace('release-chain.ts report --state', 'release-chain.ts help --state'),
    },
    {
      guard: 'chainNeverRebases',
      name: 'the push is retried with a rebase',
      file: 'chain',
      mutate: (text) =>
        text.replace(
          "command: ['git', 'push', 'origin', `HEAD:${targetBranch}`],",
          "command: ['git', 'pull', '--rebase', 'origin', 'develop'],",
        ),
    },
  ];

  test.each(Object.keys(guards) as TGuard[])('the real files satisfy the guard %s', (name) => {
    expect(guards[name](files)).toBe(true);
  });

  test('the real workflow and the smoke script run the pinned VULCAN', () => {
    expect(guards.pinnedVulcan(files)).toBe(true);
  });

  test.each(mutations)('$guard fails when $name', ({ guard, mutate, file }) => {
    const target = file ?? 'workflow';
    const mutated = mutate(files[target]);

    expect(mutated).not.toBe(files[target]);
    expect(guards[guard]({ ...files, [target]: mutated })).toBe(false);
  });

  test('pinnedVulcan fails when preset-smoke asks for the latest VULCAN', () => {
    expect(
      guards.pinnedVulcan({
        ...files,
        workflow: files.workflow.replace(
          /VULCAN_CMD: bun x @venizia\/vulcan@\S+/,
          'VULCAN_CMD: bun x @venizia/vulcan@latest',
        ),
      }),
    ).toBe(false);
    expect(
      guards.pinnedVulcan({
        ...files,
        presetSmoke: files.presetSmoke.replace(
          /bun x @venizia\/vulcan@\S+/,
          'bun x @venizia/vulcan@latest',
        ),
      }),
    ).toBe(false);
  });

  test('a guard needs the jobs it reads', () => {
    expect(Object.keys(jobsOf(files.workflow)).toSorted()).toEqual([
      'approve',
      'heal-next',
      'plan',
      'publish',
      'test',
    ]);
  });
});

// release.ts runs main() only as a script, so its preflight is the pure function it calls.
describe('isTrustedPublishWorkflow: the files make release may dispatch', () => {
  const workflow = workflowText;
  const chain = chainText;

  test('the real workflow and chain pass', () => {
    expect(isTrustedPublishWorkflow({ workflow, chain })).toBe(true);
  });

  test('the old shape, bun publish and no pack by bun, fails', () => {
    const oldShape = [
      '      - name: Publish to NPM',
      '        run: |',
      '          cd $PACKAGE_PATH',
      '          bun publish --access public --tag $NPM_TAG --ignore-scripts',
      '',
    ].join('\n');

    expect(isTrustedPublishWorkflow({ workflow: oldShape, chain: oldShape })).toBe(false);
  });

  test('the old workflow with the commands in YAML and no chain fails', () => {
    const inYaml = [
      '          (cd "$PACKAGE_PATH" && bun pm pack --quiet --filename "$TARBALLS/package.tgz")',
      '          npm publish "$TARBALLS/package.tgz" --access public --provenance',
      '',
    ].join('\n');

    expect(isTrustedPublishWorkflow({ workflow: inYaml, chain: '' })).toBe(false);
  });

  test('the chain fails when the publish drops the provenance', () => {
    expect(
      isTrustedPublishWorkflow({ workflow, chain: chain.replace("'--provenance',", '') }),
    ).toBe(false);
  });

  test('the chain fails when the tarball is no longer packed by bun', () => {
    expect(
      isTrustedPublishWorkflow({
        workflow,
        chain: chain.replace("'bun', 'pm', 'pack'", "'npm', 'pack'"),
      }),
    ).toBe(false);
  });

  test('the workflow fails when it no longer runs the chain', () => {
    expect(
      isTrustedPublishWorkflow({
        workflow: workflow.replace('bun scripts/release/release-chain.ts "${ARGS[@]}"', 'true'),
        chain,
      }),
    ).toBe(false);
  });

  test('a call of the chain that only reports is not a release', () => {
    const reportOnly = workflow.replace(
      'bun scripts/release/release-chain.ts "${ARGS[@]}"',
      'bun scripts/release/release-chain.ts report --state x',
    );

    expect(isTrustedPublishWorkflow({ workflow: reportOnly, chain })).toBe(false);
  });

  test('a comment that names the commands is not the commands', () => {
    const commented = "// 'bun', 'pm', 'pack'\n// 'npm', 'publish', 'x', '--provenance'\n";

    expect(isTrustedPublishWorkflow({ workflow, chain: commented })).toBe(false);
    expect(
      isTrustedPublishWorkflow({
        workflow: '# bun scripts/release/release-chain.ts --packages x\n',
        chain,
      }),
    ).toBe(false);
  });
});

describe('the stable gates (S4.3, S4.4, C3.4)', () => {
  test('highest moves only to a semver-greater version', () => {
    expect(shouldMoveHighest({ published: '0.4.9', current: '0.4.10-0' })).toBe(false);
    expect(shouldMoveHighest({ published: '0.4.10-0', current: '0.4.9' })).toBe(true);
    expect(shouldMoveHighest({ published: '0.4.9', current: '0.4.9' })).toBe(false);
    expect(shouldMoveHighest({ published: '0.4.9-1', current: '0.4.9' })).toBe(false);
    expect(shouldMoveHighest({ published: '0.4.9', current: undefined })).toBe(true);
  });

  test('a stable leaves next where it is when next is ahead, and moves it when next is behind', () => {
    expect(
      nextTagsToHeal({ packages: [{ name: '@venizia/ardor', latest: '0.4.9', next: '0.4.10-0' }] }),
    ).toEqual([]);
    expect(
      nextTagsToHeal({ packages: [{ name: '@venizia/ardor', latest: '0.4.9', next: '0.4.8-3' }] }),
    ).toEqual([{ name: '@venizia/ardor', latest: '0.4.9' }]);
  });

  test('a prerelease range of an IGNIS package fails stable-deps, a stable range passes', () => {
    expect(
      prereleaseRanges({ manifest: { dependencies: { '@venizia/ignis-kernel': '^0.4.6-1' } } }),
    ).toEqual(['@venizia/ignis-kernel@^0.4.6-1']);
    expect(
      prereleaseRanges({ manifest: { dependencies: { '@venizia/ignis-kernel': '^0.4.5' } } }),
    ).toEqual([]);
  });

  test('every block that names packages is read, a preset included', () => {
    expect(
      prereleaseRanges({
        manifest: {
          devDependencies: { '@venizia/ignis-boot': '0.4.6-0' },
          peerDependencies: { '@venizia/ignis-helpers': '~0.4.6-rc.1' },
          peers: { '@venizia/ignis-filter': '0.4.6-2' },
          optionalDependencies: { '@venizia/ignis-inversion': '0.4.6-1' },
        },
      }),
    ).toHaveLength(4);
  });

  test('the ARDOR siblings and other packages are not its business', () => {
    expect(
      prereleaseRanges({
        manifest: {
          dependencies: {
            '@venizia/ardor-kernel': '0.4.9-1',
            react: '^19.0.0-rc.1',
            lodash: '^4.0.0',
          },
        },
      }),
    ).toEqual([]);
  });
});

describe('release-gates.ts stable-deps on a preset folder (found by the stable rehearsal)', () => {
  const folderWith = (opts: { range: string }): string => {
    const root = makeScratch({ prefix: 'stable-deps-' });
    roots.push(root);
    mkdirSync(join(root, 'app', 'files'), { recursive: true });
    writeFileSync(
      join(root, 'app', 'preset.json'),
      JSON.stringify({ dependencies: { '@venizia/ignis-kernel': opts.range } }),
    );
    // The templates are not manifests: a tsconfig has comments, which is not JSON.
    writeFileSync(
      join(root, 'app', 'files', 'tsconfig.json'),
      '// a comment\n{ "compilerOptions": {} }\n',
    );

    return root;
  };
  const gate = (path: string) =>
    Bun.spawnSync(['bun', join(ROOT, 'scripts/release/release-gates.ts'), 'stable-deps', path], {
      cwd: ROOT,
    });

  test('the templates are skipped and a stable range passes', () => {
    expect(gate(folderWith({ range: '0.4.5' })).exitCode).toBe(0);
  });

  test('a prerelease range in preset.json fails and is named', () => {
    const result = gate(folderWith({ range: '0.4.6-1' }));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('@venizia/ignis-kernel@0.4.6-1');
  });
});

describe('workspaceMembers: the member folders come from the root workspaces field (#443)', () => {
  const repo = (opts: { workspaces?: unknown; folders: string[] }): string => {
    const root = temp();

    if (opts.workspaces !== undefined) {
      write(root, 'package.json', JSON.stringify({ workspaces: opts.workspaces }));
    }

    for (const folder of opts.folders) {
      write(root, `${folder}/package.json`, '{}');
    }

    return root;
  };

  test('an array of globs, any layout', () => {
    const root = repo({
      workspaces: ['apps/*', 'libs/*', 'tools/cli'],
      folders: ['apps/web', 'libs/a', 'libs/b', 'tools/cli', 'other/x'],
    });

    expect(workspaceMembers({ root })).toEqual(['apps/web', 'libs/a', 'libs/b', 'tools/cli']);
  });

  test('the object form with a packages array, as ARDOR itself writes it', () => {
    const root = repo({
      workspaces: { packages: ['packages/*', 'docs/*'], catalog: { react: '^19.0.0' } },
      folders: ['packages/kernel', 'docs/wiki', 'apps/web'],
    });

    expect(workspaceMembers({ root })).toEqual(['docs/wiki', 'packages/kernel']);
  });

  test('a ! pattern excludes, and a folder under node_modules is never a member', () => {
    const root = repo({
      workspaces: ['libs/*', '!libs/legacy'],
      folders: ['libs/a', 'libs/legacy', 'libs/node_modules'],
    });
    write(root, 'libs/a/node_modules/dep/package.json', '{}');

    expect(workspaceMembers({ root })).toEqual(['libs/a']);
  });

  test('no workspaces field, or no package.json, is no member', () => {
    expect(
      workspaceMembers({ root: repo({ workspaces: undefined, folders: ['packages/a'] }) }),
    ).toEqual([]);
    expect(workspaceMembers({ root: repo({ workspaces: {}, folders: ['packages/a'] }) })).toEqual(
      [],
    );
  });
});

describe('duplicateCopies: one @venizia package resolves to one version (#434)', () => {
  const manifest = (name: string, version: string): string => JSON.stringify({ name, version });

  /**
   * A bun-style store: each member links into the store, and each store entry links its own dependencies.
   * The members default to `packages/kernel` and `packages/ardor`; a consumer repo has other folders.
   */
  const tree = (opts: {
    ardorKernel: string;
    ardor: string;
    folders?: [string, string];
    workspaces?: unknown;
    /** The `name@version` ids a `bun.lock` holds; no lock when left out. */
    lock?: string[];
  }): string => {
    const root = temp();
    const [kernelFolder, ardorFolder] = opts.folders ?? ['packages/kernel', 'packages/ardor'];
    const store = (name: string, version: string): string =>
      join(
        root,
        'node_modules',
        '.bun',
        `@venizia+${name}@${version}`,
        'node_modules',
        '@venizia',
        name,
      );
    const link = (folder: string, name: string, version: string) => {
      write(root, `${folder}/package.json`, '{}');
      write(
        root,
        `node_modules/.bun/@venizia+${name}@${version}/node_modules/@venizia/${name}/package.json`,
        manifest(`@venizia/${name}`, version),
      );
      mkdirSync(join(root, folder, 'node_modules', '@venizia'), { recursive: true });
      symlinkSync(store(name, version), join(root, folder, 'node_modules', '@venizia', name));
    };

    write(
      root,
      'package.json',
      JSON.stringify({ workspaces: opts.workspaces ?? { packages: ['packages/*'] } }),
    );
    link(kernelFolder, 'ignis-inversion', opts.ardorKernel);
    link(ardorFolder, 'ignis-inversion', opts.ardor);

    if (opts.lock !== undefined) {
      // bun.lock is JSONC: a trailing comma after the last entry, as bun writes it.
      const entries = opts.lock.map((id) => `    "${id}": ["${id}", "", {}, "sha512-x"],`);
      write(
        root,
        'bun.lock',
        `{\n  "lockfileVersion": 1,\n  "packages": {\n${entries.join('\n')}\n  }\n}\n`,
      );
    }

    return root;
  };

  test('members that agree pass', () => {
    expect(duplicateCopies({ root: tree({ ardorKernel: '0.4.5-0', ardor: '0.4.5-0' }) })).toEqual(
      [],
    );
  });

  test('a member on the stable copy next to a prerelease is named with both versions', () => {
    const copies = duplicateCopies({ root: tree({ ardorKernel: '0.4.5-0', ardor: '0.4.4' }) });

    expect(copies).toEqual([
      '@venizia/ignis-inversion - 0.4.4 (packages/ardor) | 0.4.5-0 (packages/kernel)',
    ]);
  });

  test('an old version left in the store, that nobody resolves, is not a duplicate', () => {
    const root = tree({ ardorKernel: '0.4.5-0', ardor: '0.4.5-0' });
    write(
      root,
      'node_modules/.bun/@venizia+ignis-inversion@0.3.5/node_modules/@venizia/ignis-inversion/package.json',
      manifest('@venizia/ignis-inversion', '0.3.5'),
    );

    expect(duplicateCopies({ root })).toEqual([]);
  });

  test('a consumer repo with no packages/ folder is walked through its workspaces (#443)', () => {
    const root = tree({
      ardorKernel: '0.4.6-0',
      ardor: '0.4.5',
      folders: ['apps/web', 'libs/merchant'],
      workspaces: ['apps/*', 'libs/*'],
    });

    expect(duplicateCopies({ root })).toEqual([
      '@venizia/ignis-inversion - 0.4.5 (libs/merchant) | 0.4.6-0 (apps/web)',
    ]);
  });

  test('a repo without a workspaces field is the root alone', () => {
    const root = tree({ ardorKernel: '0.4.6-0', ardor: '0.4.5', workspaces: [] });

    expect(duplicateCopies({ root })).toEqual([]);
  });

  describe('a version bun.lock does not hold is a stale install, not a missing declaration (#445)', () => {
    const run = (root: string) =>
      Bun.spawnSync(['bun', join(ROOT, 'scripts/release/release-gates.ts'), 'single-copy', root], {
        cwd: ROOT,
      });

    test('a version missing from the lock is marked, and the advice is a clean install', () => {
      const root = tree({
        ardorKernel: '0.4.5-0',
        ardor: '0.4.4',
        lock: ['@venizia/ignis-inversion@0.4.5-0'],
      });
      const failed = run(root);
      const message = failed.stderr.toString();

      expect(duplicateCopies({ root })).toEqual([
        '@venizia/ignis-inversion - 0.4.4 (packages/ardor) stale install | 0.4.5-0 (packages/kernel)',
      ]);
      expect(failed.exitCode).toBe(1);
      expect(message).toContain('stale install: bun.lock does not hold');
      expect(message).toContain('remove node_modules');
      expect(message).not.toContain('catalog: devDependency');
    });

    test('a version the lock holds keeps the catalog advice', () => {
      const root = tree({
        ardorKernel: '0.4.5-0',
        ardor: '0.4.4',
        lock: ['@venizia/ignis-inversion@0.4.5-0', '@venizia/ignis-inversion@0.4.4'],
      });
      const message = run(root).stderr.toString();

      expect(duplicateCopies({ root })).toEqual([
        '@venizia/ignis-inversion - 0.4.4 (packages/ardor) | 0.4.5-0 (packages/kernel)',
      ]);
      expect(message).toContain('catalog: devDependency');
      expect(message).not.toContain('stale install');
    });

    test('a repository without a bun.lock keeps the catalog advice', () => {
      const message = run(tree({ ardorKernel: '0.4.5-0', ardor: '0.4.4' })).stderr.toString();

      expect(message).toContain('catalog: devDependency');
      expect(message).not.toContain('stale install');
    });

    test('a workspace link is never stale, though the lock has no registry version for it', () => {
      const root = tree({
        ardorKernel: '0.4.5-0',
        ardor: '0.4.5-0',
        lock: ['@venizia/ignis-inversion@0.4.5-0', '@venizia/ardor-kernel@0.4.5'],
      });
      write(root, 'package.json', JSON.stringify({ workspaces: ['packages/*', 'apps/*'] }));
      write(
        root,
        'packages/kernel/package.json',
        JSON.stringify({ name: '@venizia/ardor-kernel', version: '0.4.6-0' }),
      );
      write(root, 'apps/web/package.json', '{}');
      write(
        root,
        'node_modules/.bun/@venizia+ardor-kernel@0.4.5/node_modules/@venizia/ardor-kernel/package.json',
        manifest('@venizia/ardor-kernel', '0.4.5'),
      );
      mkdirSync(join(root, 'apps/web/node_modules/@venizia'), { recursive: true });
      symlinkSync(
        join(root, 'packages/kernel'),
        join(root, 'apps/web/node_modules/@venizia/ardor-kernel'),
      );
      mkdirSync(join(root, 'packages/ardor/node_modules/@venizia'), { recursive: true });
      symlinkSync(
        join(
          root,
          'node_modules/.bun/@venizia+ardor-kernel@0.4.5/node_modules/@venizia/ardor-kernel',
        ),
        join(root, 'packages/ardor/node_modules/@venizia/ardor-kernel'),
      );

      expect(duplicateCopies({ root })).toEqual([
        '@venizia/ardor-kernel - 0.4.5 (packages/ardor) | 0.4.6-0 (apps/web)',
      ]);
    });

    test('a leftover next to two real copies gets both advices', () => {
      const root = tree({
        ardorKernel: '0.4.5-0',
        ardor: '0.4.4',
        lock: ['@venizia/ignis-inversion@0.4.5-0', '@venizia/ignis-inversion@0.4.4'],
      });
      // A third member on a version the lock never held, and a workspace entry in the lock.
      write(root, 'package.json', JSON.stringify({ workspaces: ['packages/*', 'apps/*'] }));
      write(root, 'apps/web/package.json', '{}');
      const old = join(
        root,
        'node_modules/.bun/@venizia+ignis-inversion@0.3.9/node_modules/@venizia/ignis-inversion',
      );
      write(
        root,
        `${old.slice(root.length + 1)}/package.json`,
        manifest('@venizia/ignis-inversion', '0.3.9'),
      );
      mkdirSync(join(root, 'apps/web/node_modules/@venizia'), { recursive: true });
      symlinkSync(old, join(root, 'apps/web/node_modules/@venizia/ignis-inversion'));
      const message = run(root).stderr.toString();

      expect(duplicateCopies({ root })).toEqual([
        '@venizia/ignis-inversion - 0.3.9 (apps/web) stale install | 0.4.4 (packages/ardor) | 0.4.5-0 (packages/kernel)',
      ]);
      expect(message).toContain('stale install: bun.lock does not hold');
      expect(message).toContain('catalog: devDependency');
    });
  });

  test('lockedVersions reads name@version from every entry and skips a workspace entry (#445)', () => {
    const root = temp();
    write(
      root,
      'bun.lock',
      '{ "packages": { "@venizia/ardor": ["@venizia/ardor@workspace:packages/ardor"], "a/@venizia/x": ["@venizia/x@1.2.3-0", "", {}, "h"], }, }',
    );

    expect(lockedVersions({ root })).toEqual(new Map([['@venizia/x', new Set(['1.2.3-0'])]]));
    expect(lockedVersions({ root: temp() })).toBeUndefined();
  });

  test('the command line exits 1 on a duplicate and names it, and 0 on a clean tree', () => {
    const run = (root: string) =>
      Bun.spawnSync(['bun', join(ROOT, 'scripts/release/release-gates.ts'), 'single-copy', root], {
        cwd: ROOT,
      });
    const broken = run(tree({ ardorKernel: '0.4.5-0', ardor: '0.4.4' }));

    expect(broken.exitCode).toBe(1);
    expect(broken.stderr.toString()).toContain('@venizia/ignis-inversion');
    expect(run(tree({ ardorKernel: '0.4.5-0', ardor: '0.4.5-0' })).exitCode).toBe(0);
  });
});
