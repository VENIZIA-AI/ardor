import { describe, expect, test } from 'bun:test';

import {
  type IChainOptions,
  type IChainPorts,
  type IChainPackage,
  ReleaseChain,
  runChain,
} from '../release-chain';

const NAMES: Record<string, string> = {
  kernel: '@venizia/ardor-kernel',
  react: '@venizia/ardor-react',
  admin: '@venizia/ardor-admin',
  ardor: '@venizia/ardor',
};

const packagesOf = (names: string[]): IChainPackage[] =>
  names.map((name) => ({ name, packageName: NAMES[name] as string }));

const optionsOf = (names: string[], extra: Partial<IChainOptions> = {}): IChainOptions => ({
  packages: packagesOf(names),
  version: '0.4.6-0',
  npmTag: 'next',
  tarballs: '/work/tarballs',
  tmp: '/work/tmp',
  ...extra,
});

interface IHarness {
  ports: IChainPorts;
  events: string[];
  commands: () => string[];
  states: string[];
}

/** The package a command is about: its folder, its tarball, its relock folder, its commit or its tag. */
const currentOf = (text: string, cwd?: string): string | undefined => {
  const subject = `${cwd ?? ''} ${text}`;
  for (const pattern of [
    /packages\/(kernel|react|admin|ardor)\b/,
    /\/(kernel|react|admin|ardor)\.tgz/,
    /relock-(kernel|react|admin|ardor)\b/,
    /chore\((kernel|react|admin|ardor)\)/,
    /\b(kernel|react|admin|ardor)-v\d/,
  ]) {
    const found = pattern.exec(subject);
    if (found) {
      return found[1];
    }
  }

  return undefined;
};

/** Fake ports: every call is recorded in order; `fail` makes a matching command exit 1. */
const harness = (opts: {
  manifests?: Record<string, string>;
  onNpm?: string[];
  tagged?: string[];
  fail?: (command: string) => boolean;
  /** The failure switches below act only while this package is the one being released. */
  scope?: string;
  failWait?: boolean;
  shaChanges?: boolean;
  packedVersion?: string;
  /** `merge-base --is-ancestor`: true when develop already holds the release commit. */
  developHolds?: boolean;
  builtOn?: string;
  /** `git log --grep` finds no release commit. */
  noReleaseCommit?: boolean;
  /** The dependencies the packed manifest of the package in scope carries. */
  packedDependencies?: Record<string, string>;
  /** The peerDependencies the packed manifest of the package in scope carries. */
  packedPeerDependencies?: Record<string, string>;
}): IHarness => {
  const events: string[] = [];
  const states: string[] = [];
  const shaCalls: Record<string, number> = {};
  let current = '';
  const inScope = () => opts.scope === undefined || opts.scope === current;

  const ports: IChainPorts = {
    run: async ({ command, cwd }) => {
      const text = command.join(' ');
      events.push(`run ${text}`);
      current = currentOf(text, cwd) ?? current;
      if (inScope() && opts.fail?.(text)) {
        return { exitCode: 1, stdout: '' };
      }
      if (text === 'git rev-parse HEAD') {
        return { exitCode: 0, stdout: 'abc1234567\n' };
      }
      if (text.includes('merge-base --is-ancestor')) {
        return { exitCode: opts.developHolds ? 0 : 1, stdout: '' };
      }
      if (text.startsWith('git log -1 --format=%H')) {
        return { exitCode: 0, stdout: opts.noReleaseCommit ? '' : 'deadbeef00\n' };
      }
      if (text.startsWith('tar -xzOf')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            name: 'x',
            version: (inScope() ? opts.packedVersion : undefined) ?? '0.4.6-0',
            ...(inScope() && opts.packedDependencies !== undefined
              ? { dependencies: opts.packedDependencies }
              : {}),
            ...(inScope() && opts.packedPeerDependencies !== undefined
              ? { peerDependencies: opts.packedPeerDependencies }
              : {}),
          }),
        };
      }
      return { exitCode: 0, stdout: '' };
    },
    readManifest: ({ path }) => {
      const name = path.split('/')[1] as string;
      return { name: NAMES[name] as string, version: opts.manifests?.[name] ?? '0.4.5' };
    },
    hasVersion: async ({ packageName, version }) => {
      events.push(`hasVersion ${packageName}@${version}`);
      return (opts.onNpm ?? []).includes(packageName);
    },
    tagOnOrigin: async ({ tag }) => (opts.tagged ?? []).includes(tag),
    waitForTarball: async ({ packageName }) => {
      events.push(`wait ${packageName}`);
      current = Object.keys(NAMES).find((key) => NAMES[key] === packageName) ?? current;
      if (opts.failWait && inScope()) {
        throw new Error('still 404');
      }
    },
    sha256: async ({ path }) => {
      const key = path.split('/').pop() ?? '';
      shaCalls[key] = (shaCalls[key] ?? 0) + 1;
      const scoped = opts.scope === undefined || key === `${opts.scope}.tgz`;
      return opts.shaChanges && scoped && (shaCalls[key] ?? 0) > 1 ? 'changed' : 'abc';
    },
    writeFile: async ({ path, content }) => {
      events.push(`write ${path}`);
      if (path.endsWith('state.json')) {
        states.push(content);
      }
    },
    sleep: async (ms) => {
      events.push(`sleep ${ms}`);
    },
    log: () => {},
    ...(opts.builtOn === undefined ? {} : { readBuiltOn: () => opts.builtOn as string }),
  };

  return {
    ports,
    events,
    states,
    commands: () => events.filter((event) => event.startsWith('run ')).map((e) => e.slice(4)),
  };
};

const indexOfCommand = (commands: string[], needle: string, from = 0): number =>
  commands.findIndex((command, index) => index >= from && command.includes(needle));

describe('ReleaseChain.plan', () => {
  const { phaseA, phaseP, phaseB, phaseR } = ReleaseChain.plan({
    options: optionsOf(['kernel', 'react', 'admin', 'ardor'], {
      chainReleased: ['@venizia/ardor-kernel'],
    }),
  });
  const labels = (steps: typeof phaseA) => steps.map((step) => step.label);
  const text = (steps: typeof phaseA) => steps.map((step) => ReleaseChain.describe({ step }));

  test('phase A holds no publish and no git write', () => {
    for (const step of phaseA) {
      const text = ReleaseChain.describe({ step });
      expect(text).not.toContain('npm publish');
      expect(text).not.toContain('git commit');
      expect(text).not.toContain('git push');
    }
  });

  test('phase A runs the six checks for each package', () => {
    expect(labels(phaseA).filter((label) => label.startsWith('react:'))).toEqual([
      'react: links',
      'react: build',
      'react: artifacts',
      'react: pack',
      'react: protocols',
      'react: registry',
    ]);
  });

  test('the registry check is told the planned packages', () => {
    const registry = phaseA.find((step) => step.label === 'react: registry');

    expect(registry && ReleaseChain.describe({ step: registry })).toContain(
      '--chain-released @venizia/ardor-kernel',
    );
  });

  test('phase P prepares a package: bump, pack, check the manifest and the pins, record the sha', () => {
    expect(labels(phaseP).filter((label) => label.startsWith('react:'))).toEqual([
      'react: bump',
      'react: pack the tarball to publish',
      'react: check the packed manifest',
      'react: record the sha256',
    ]);
  });

  test('phase P ends with one clean-install over the tarballs of the whole run, and publishes nothing', () => {
    const installs = labels(phaseP).filter((label) => label.startsWith('clean-install'));

    expect(installs).toEqual([
      'clean-install: kernel, react, admin, ardor from their own tarballs',
    ]);
    expect(labels(phaseP).at(-1)).toBe(installs[0]);
    expect(text(phaseP).at(-1)).toContain(
      'bun scripts/checks/clean-install/cli.ts kernel react admin ardor',
    );
    for (const line of text(phaseP)) {
      expect(line).not.toContain('npm publish');
      expect(line).not.toContain('git commit');
      expect(line).not.toContain('git push');
      expect(line).not.toContain('git tag');
    }
  });

  test('phase B only checks the sha and publishes: no wait, no dist-tag, no git write', () => {
    expect(labels(phaseB).filter((label) => label.startsWith('react:'))).toEqual([
      'react: check the sha256',
      'react: publish',
    ]);
    expect(phaseB.some((step) => step.kind === 'wait')).toBe(false);
    for (const line of text(phaseB)) {
      expect(line).not.toContain('tag-highest');
      expect(line).not.toContain('git ');
    }
  });

  test('phase R records a package: the wait, the dist-tags, the release commit, the push and the tag', () => {
    expect(labels(phaseR).filter((label) => label.startsWith('react:'))).toEqual([
      'react: wait for the tarball to answer 200',
      'react: tag highest',
      'react: keep next at or above latest',
      'react: clear the relock folder',
      'react: make the relock folder',
      'react: copy HEAD to the relock folder',
      'react: copy the bumped manifest',
      'react: relock',
      'react: copy the lockfile back',
      'react: stage the release',
      'react: commit',
      'react: push',
      'react: annotate the tag',
      'react: push the tag',
    ]);
  });

  test('the preset is written for ardor only, after the bump and before the pack', () => {
    const all = labels(phaseP);

    expect(all.filter((label) => label.includes('preset'))).toEqual([
      'ardor: write the VULCAN preset',
    ]);
    expect(all.indexOf('ardor: bump')).toBeLessThan(all.indexOf('ardor: write the VULCAN preset'));
    expect(all.indexOf('ardor: write the VULCAN preset')).toBeLessThan(
      all.indexOf('ardor: pack the tarball to publish'),
    );
    // Every package is bumped before the preset names their versions.
    expect(all.indexOf('admin: bump')).toBeLessThan(all.indexOf('ardor: write the VULCAN preset'));
  });

  test('the publish is a provenance publish of an absolute tarball, with the dist-tag', () => {
    const publish = phaseB.find((step) => step.label === 'kernel: publish');

    expect(publish && ReleaseChain.describe({ step: publish })).toBe(
      'kernel: publish: npm publish /work/tarballs/kernel.tgz --access public --tag next --ignore-scripts --provenance',
    );
  });

  test('the chain never pulls or rebases', () => {
    const everything = [...phaseA, ...phaseP, ...phaseB, ...phaseR]
      .map((step) => ReleaseChain.describe({ step }))
      .join('\n');

    expect(everything).not.toContain('git pull');
    expect(everything).not.toContain('rebase');
  });

  test('the release branch is made once, before the first commit', () => {
    const { phaseR: withBranch } = ReleaseChain.plan({
      options: optionsOf(['kernel', 'react'], { branch: 'release-42' }),
    });
    const switches = labels(withBranch).filter((label) => label === 'switch to the release branch');

    expect(switches).toHaveLength(1);
    expect(labels(withBranch).indexOf('switch to the release branch')).toBeLessThan(
      labels(withBranch).indexOf('kernel: commit'),
    );
  });

  test('the commit subject carries the issue and the version', () => {
    const { phaseR: withIssue } = ReleaseChain.plan({
      options: optionsOf(['kernel'], { issue: '412' }),
    });
    const commit = withIssue.find((step) => step.label === 'kernel: commit');

    expect(commit && 'command' in commit && commit.command.at(-1)).toBe(
      '[#412] chore(kernel): release v0.4.6-0 [0.4.6-0]',
    );
  });

  test('a package that only lacks its tag gets the wait and the tag on the release commit, nothing else', () => {
    const plan = ReleaseChain.plan({
      options: {
        ...optionsOf(['kernel']),
        packages: [{ name: 'kernel', packageName: '@venizia/ardor-kernel', mode: 'tag' }],
      },
    });

    expect(labels(plan.phaseR)).toEqual([
      'kernel: wait for the tarball to answer 200',
      'kernel: annotate the tag on the release commit',
      'kernel: push the tag',
    ]);
    expect(plan.phaseR[1]).toMatchObject({ grep: 'chore(kernel): release v0.4.6-0 ' });
  });

  test('a package an earlier dispatch published is only bumped and recorded', () => {
    const plan = ReleaseChain.plan({
      options: {
        ...optionsOf(['kernel']),
        packages: [{ name: 'kernel', packageName: '@venizia/ardor-kernel', mode: 'record' }],
      },
    });

    expect(labels(plan.phaseP)).toEqual(['kernel: bump']);
    expect(plan.phaseB).toEqual([]);
    expect(labels(plan.phaseR)).toContain('kernel: commit');
  });
});

describe('runChain: a clean run', () => {
  test('phase A for every package comes before the first publish', async () => {
    const h = harness({});
    const result = await runChain({
      options: optionsOf(['kernel', 'react', 'admin', 'ardor']),
      ports: h.ports,
    });
    const commands = h.commands();
    const firstPublish = indexOfCommand(commands, 'npm publish');

    expect(result.ok).toBe(true);
    for (const name of ['kernel', 'react', 'admin', 'ardor']) {
      expect(
        indexOfCommand(commands, `release-gates.ts registry /work/tmp/packed-${name}.json`),
      ).toBeLessThan(firstPublish);
    }
  });

  test('every package is published before any is waited for, committed or tagged', async () => {
    const h = harness({});
    await runChain({ options: optionsOf(['kernel', 'react', 'admin', 'ardor']), ports: h.ports });
    const e = h.events;
    const publishes = e
      .map((event, index) => (event.includes('.tgz --access public') ? index : -1))
      .filter((index) => index > -1);
    const firstPublish = publishes[0] as number;
    const lastPublish = publishes.at(-1) as number;
    const firstWait = e.findIndex((event) => event.startsWith('wait '));

    expect(publishes).toHaveLength(4);
    expect(firstWait).toBeGreaterThan(lastPublish);
    // Between the first and the last publish nothing is waited for, tagged or committed.
    for (const event of e.slice(firstPublish, lastPublish)) {
      expect(event).not.toMatch(/^wait |git commit|git push|git tag|tag-highest|heal-next/);
    }
    // And there is one wait for each package, after all the publishes.
    expect(e.filter((event) => event.startsWith('wait '))).toEqual([
      'wait @venizia/ardor-kernel',
      'wait @venizia/ardor-react',
      'wait @venizia/ardor-admin',
      'wait @venizia/ardor',
    ]);
  });

  test('the packages are published in dependency order, and the clean-install gate runs once, before the first publish', async () => {
    const h = harness({});
    await runChain({ options: optionsOf(['kernel', 'react', 'admin', 'ardor']), ports: h.ports });
    const commands = h.commands();
    const order = ['kernel', 'react', 'admin', 'ardor'].map((name) =>
      indexOfCommand(commands, `${name}.tgz --access public`),
    );
    const installs = commands
      .map((command, index) => (command.includes('clean-install/cli.ts') ? index : -1))
      .filter((index) => index > -1);

    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(installs).toHaveLength(1);
    expect(installs[0]).toBeLessThan(order[0] as number);
    expect(commands[installs[0] as number]).toBe(
      'bun scripts/checks/clean-install/cli.ts kernel react admin ardor',
    );
  });

  test('each package is then waited for, committed, pushed and tagged before the next one is recorded', async () => {
    const h = harness({});
    await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
    const e = h.events;
    const at = (text: string, from = 0) =>
      e.findIndex((event, index) => index >= from && event.includes(text));

    const kernelWait = at('wait @venizia/ardor-kernel');
    const kernelCommit = at('git commit -m chore(kernel)');
    const kernelPush = at('git push origin HEAD:develop', kernelCommit);
    const kernelTag = at('git push origin kernel-v0.4.6-0');
    const reactWait = at('wait @venizia/ardor-react');
    const reactCommit = at('git commit -m chore(react)');

    expect(kernelWait).toBeGreaterThan(at('react.tgz --access public'));
    expect(kernelCommit).toBeGreaterThan(kernelWait);
    expect(kernelPush).toBeGreaterThan(kernelCommit);
    expect(kernelTag).toBeGreaterThan(kernelPush);
    expect(reactWait).toBeGreaterThan(kernelTag);
    expect(reactCommit).toBeGreaterThan(reactWait);
  });

  test('every package ends tagged', async () => {
    const h = harness({});
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.states.map((state) => state.stage)).toEqual(['tagged', 'tagged']);
  });

  test('the state of the packages is written after each step', async () => {
    const h = harness({});
    await runChain({
      options: optionsOf(['kernel'], { statePath: '/work/state.json' }),
      ports: h.ports,
    });

    expect(h.states.length).toBeGreaterThan(10);
    expect(JSON.parse(h.states.at(-1) as string).states[0].stage).toBe('tagged');
  });
});

describe('runChain: what is already released (D5)', () => {
  test('a package at the version, on npm and tagged, is skipped; the others are released', async () => {
    const h = harness({
      manifests: { kernel: '0.4.6-0' },
      onNpm: ['@venizia/ardor-kernel'],
      tagged: ['kernel-v0.4.6-0'],
    });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
    const commands = h.commands();

    expect(result.ok).toBe(true);
    expect(result.states[0]?.skipped).toBe(true);
    expect(indexOfCommand(commands, 'kernel.tgz')).toBe(-1);
    expect(indexOfCommand(commands, 'react.tgz --access public')).toBeGreaterThan(-1);
  });

  test('on npm with the manifest below the version: it is recorded without a second publish', async () => {
    const h = harness({ onNpm: ['@venizia/ardor-react'] });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
    const commands = h.commands();

    expect(result.ok).toBe(true);
    expect(result.states.map((state) => state.mode)).toEqual(['full', 'record']);
    expect(result.states.map((state) => state.stage)).toEqual(['tagged', 'tagged']);
    // kernel is published, react is not published again; react is bumped, committed and tagged.
    expect(indexOfCommand(commands, 'kernel.tgz --access public')).toBeGreaterThan(-1);
    expect(indexOfCommand(commands, 'react.tgz')).toBe(-1);
    expect(indexOfCommand(commands, 'npm version 0.4.6-0')).toBeGreaterThan(-1);
    expect(indexOfCommand(commands, 'git commit -m chore(react)')).toBeGreaterThan(-1);
    expect(indexOfCommand(commands, 'git push origin react-v0.4.6-0')).toBeGreaterThan(-1);
    expect(commands.filter((command) => command.includes('npm version'))).toHaveLength(2);
    // The clean-install gate covers what this run packs, not the package that was published before.
    expect(commands.find((command) => command.includes('clean-install/cli.ts'))).toBe(
      'bun scripts/checks/clean-install/cli.ts kernel',
    );
  });

  test('a phase A stop before the bump of a package published earlier does not try to record it', async () => {
    const h = harness({
      onNpm: ['@venizia/ardor-react'],
      fail: (command) =>
        command.includes('release-gates.ts protocols /work/tmp/packed-kernel.json'),
    });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(indexOfCommand(h.commands(), 'git commit')).toBe(-1);
    expect(indexOfCommand(h.commands(), 'npm version')).toBe(-1);
  });

  test('the manifest at the version but not on npm: stop and say so', async () => {
    const h = harness({ manifests: { kernel: '0.4.6-0' } });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(h.commands()).toEqual([]);
    expect(result.report).toContain('a bump without a publish');
  });

  test('the manifest at the version, on npm, the tag missing: the tag is written on the release commit', async () => {
    const h = harness({ manifests: { kernel: '0.4.6-0' }, onNpm: ['@venizia/ardor-kernel'] });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });
    const commands = h.commands();

    expect(result.ok).toBe(true);
    expect(result.states[0]?.mode).toBe('tag');
    expect(result.states[0]?.stage).toBe('tagged');
    expect(commands).toEqual([
      expect.stringContaining(
        'git log -1 --format=%H --fixed-strings --grep chore(kernel): release v0.4.6-0 ',
      ),
      'git tag -a kernel-v0.4.6-0 -m @venizia/ardor-kernel v0.4.6-0 deadbeef00',
      'git push origin kernel-v0.4.6-0',
    ]);
    expect(h.events).toContain('wait @venizia/ardor-kernel');
  });

  test('the tag of a released package cannot be written when its release commit is not in the history', async () => {
    const h = harness({
      manifests: { kernel: '0.4.6-0' },
      onNpm: ['@venizia/ardor-kernel'],
      noReleaseCommit: true,
    });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(result.report).toContain('no release commit');
    expect(indexOfCommand(h.commands(), 'git tag')).toBe(-1);
  });

  test('a manifest above the version stops the run', async () => {
    const h = harness({ manifests: { kernel: '0.5.0' } });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(result.report).toContain('above 0.4.6-0');
  });

  test('the registry is asked once per package, before any command runs', async () => {
    const h = harness({});
    await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
    const firstCommand = h.events.findIndex((event) => event.startsWith('run '));

    expect(
      h.events.slice(0, firstCommand).filter((event) => event.startsWith('hasVersion')),
    ).toHaveLength(2);
  });
});

describe('runChain: stops', () => {
  test('a phase A failure publishes nothing and runs no phase B command', async () => {
    const h = harness({
      fail: (command) => command.includes('release-gates.ts protocols /work/tmp/packed-react.json'),
    });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(indexOfCommand(h.commands(), 'npm publish')).toBe(-1);
    expect(indexOfCommand(h.commands(), 'npm version')).toBe(-1);
    expect(result.report).toContain('Nothing of this package was published');
  });

  const stopPlan = ReleaseChain.plan({ options: optionsOf(['kernel', 'react']) });
  const reactSteps = (steps: typeof stopPlan.phaseP) =>
    steps
      .filter((step) => step.label.startsWith('react:'))
      .filter((step) => !('fatal' in step) || step.fatal)
      .filter((step) => step.kind !== 'record-sha' && step.kind !== 'push-tag');
  const stopHarness = (step: (typeof stopPlan.phaseP)[number]) => {
    const failCommand = 'command' in step ? step.command.join(' ') : undefined;

    return harness({
      scope: 'react',
      fail: (command) => command === failCommand,
      failWait: step.kind === 'wait',
      shaChanges: step.kind === 'verify-sha',
      packedVersion: step.kind === 'manifest' ? '9.9.9' : undefined,
    });
  };

  // Phase P: nothing is published yet, so a stop leaves npm as it was and git without a release commit.
  for (const step of [
    ...reactSteps(stopPlan.phaseP),
    ...stopPlan.phaseP.filter((candidate) => candidate.label.startsWith('clean-install')),
  ]) {
    test(`a failure at "${step.label}" (phase P) publishes nothing, not even kernel`, async () => {
      const h = stopHarness(step);
      const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

      expect(result.ok).toBe(false);
      expect(indexOfCommand(h.commands(), 'npm publish')).toBe(-1);
      expect(indexOfCommand(h.commands(), 'git commit')).toBe(-1);
      expect(result.states.map((state) => state.stage)).toEqual(['none', 'none']);
    });
  }

  // Phase B: kernel is already on npm, so it is recorded before the run stops; react is not.
  for (const step of reactSteps(stopPlan.phaseB)) {
    test(`a failure at "${step.label}" (phase B) records kernel and runs nothing of react after it`, async () => {
      const h = stopHarness(step);
      const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
      const commands = h.commands();

      expect(result.ok).toBe(false);
      expect(result.states[0]?.stage).toBe('tagged');
      expect(indexOfCommand(commands, 'git push origin kernel-v0.4.6-0')).toBeGreaterThan(-1);
      expect(indexOfCommand(commands, 'git commit -m chore(react)')).toBe(-1);
      expect(indexOfCommand(commands, 'git push origin react-v0.4.6-0')).toBe(-1);
      expect(h.events).toContain('wait @venizia/ardor-kernel');
      expect(h.events).not.toContain('wait @venizia/ardor-react');
    });
  }

  // Phase R: every package is on npm; kernel is recorded, react stops at the step.
  for (const step of reactSteps(stopPlan.phaseR)) {
    test(`a failure at "${step.label}" (phase R) leaves kernel done and react published without its tag`, async () => {
      const h = stopHarness(step);
      const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

      expect(result.ok).toBe(false);
      expect(result.states[0]?.stage).toBe('tagged');
      expect(result.states[1]?.stage).not.toBe('tagged');
      expect(indexOfCommand(h.commands(), 'react.tgz --access public')).toBeGreaterThan(-1);
      expect(indexOfCommand(h.commands(), 'git push origin react-v0.4.6-0')).toBe(-1);
    });
  }

  test('a stop in phase B still records what was published, and the report says what to dispatch', async () => {
    const h = harness({
      scope: 'react',
      fail: (command) => command.includes('react.tgz --access public'),
    });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.states.map((state) => state.stage)).toEqual(['tagged', 'attempted']);
    expect(result.report).toContain('Done: kernel.');
    expect(result.report).toContain('its outcome is unknown');
  });

  test('a stop in phase B after three of four are published records those three', async () => {
    const h = harness({
      scope: 'ardor',
      fail: (command) => command.includes('ardor.tgz --access public'),
    });
    const result = await runChain({
      options: optionsOf(['kernel', 'react', 'admin', 'ardor']),
      ports: h.ports,
    });

    expect(result.states.map((state) => state.stage)).toEqual([
      'tagged',
      'tagged',
      'tagged',
      'attempted',
    ]);
    expect(h.events.filter((event) => event.startsWith('wait '))).toEqual([
      'wait @venizia/ardor-kernel',
      'wait @venizia/ardor-react',
      'wait @venizia/ardor-admin',
    ]);
  });

  test('a record that fails after a stop is a warning, and the stop is still the one reported', async () => {
    const h = harness({
      scope: 'react',
      fail: (command) =>
        command.includes('react.tgz --access public') || command === 'git push origin HEAD:develop',
    });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(result.report).toContain('react: publish');
  });

  test('a rejected push stops the run with no pull and no rebase; the other package is published and the report says so', async () => {
    const h = harness({ fail: (command) => command === 'git push origin HEAD:develop' });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
    const commands = h.commands();

    expect(result.ok).toBe(false);
    expect(result.states.map((state) => state.stage)).toEqual(['committed', 'published']);
    expect(
      commands.some((command) => command.includes('git pull') || command.includes('rebase')),
    ).toBe(false);
    expect(indexOfCommand(commands, 'react.tgz --access public')).toBeGreaterThan(-1);
    expect(indexOfCommand(commands, 'git commit -m chore(react)')).toBe(-1);
    expect(result.report).toContain('the push to develop did not land');
    expect(result.report).toContain('Published and not yet recorded in git: react.');
    expect(result.report).toContain('Dispatch the same version again');
  });

  test('a failing publish is reported as attempted, outcome unknown', async () => {
    const h = harness({ fail: (command) => command.includes('npm publish') });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.states[0]?.stage).toBe('attempted');
    expect(result.report).toContain('its outcome is unknown');
    expect(result.report).toContain('npm view @venizia/ardor-kernel versions');
    expect(result.report).toContain('records it without a second publish');
  });

  test('a changed tarball stops before the publish was attempted', async () => {
    const h = harness({ shaChanges: true });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(indexOfCommand(h.commands(), 'npm publish')).toBe(-1);
    expect(result.states[0]?.stage).toBe('none');
  });

  test('a tarball that is not the version of this run stops before the publish', async () => {
    const h = harness({ packedVersion: '0.4.5' });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(result.report).toContain('the tarball is 0.4.5, this run releases 0.4.6-0');
    expect(indexOfCommand(h.commands(), 'npm publish')).toBe(-1);
  });

  test('a tarball that never answers 200 stops after the publish and before the commit', async () => {
    const h = harness({ failWait: true });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.states[0]?.stage).toBe('published');
    expect(result.report).toContain('is published but not committed');
    expect(indexOfCommand(h.commands(), 'git commit')).toBe(-1);
  });

  test('a missing tag push after three tries leaves the package pushed, tag missing', async () => {
    const h = harness({ fail: (command) => command === 'git push origin kernel-v0.4.6-0' });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.states[0]?.stage).toBe('pushed');
    expect(
      h.events.filter((event) => event === 'run git push origin kernel-v0.4.6-0'),
    ).toHaveLength(3);
    expect(h.events.filter((event) => event.startsWith('sleep'))).toEqual([
      'sleep 10000',
      'sleep 20000',
    ]);
    expect(result.report).toContain('only the tag is missing');
  });
});

describe('runChain: a heal run, with the first package already published', () => {
  const healed = (extra: Parameters<typeof harness>[0] = {}) =>
    harness({ onNpm: ['@venizia/ardor-kernel'], ...extra });

  test('the tarball folder is made for the first package that packs, also when the first package is only recorded', async () => {
    const h = healed();
    const result = await runChain({
      options: optionsOf(['kernel', 'react', 'admin', 'ardor']),
      ports: h.ports,
    });
    const commands = h.commands();

    expect(result.ok).toBe(true);
    expect(commands.filter((command) => command === 'mkdir -p /work/tarballs')).toHaveLength(1);
    expect(indexOfCommand(commands, 'mkdir -p /work/tarballs')).toBeLessThan(
      indexOfCommand(commands, 'react.tgz'),
    );
  });

  test('the plan makes the folder in the first package that packs, too', () => {
    const plan = ReleaseChain.plan({
      options: {
        ...optionsOf(['kernel', 'react']),
        packages: [
          { name: 'kernel', packageName: NAMES.kernel as string, mode: 'record' },
          { name: 'react', packageName: NAMES.react as string, mode: 'full' },
        ],
      },
    });
    const labels = plan.phaseP.map((step) => step.label);

    expect(labels.indexOf('make the tarball folder')).toBeGreaterThan(
      labels.indexOf('kernel: bump'),
    );
    expect(labels.indexOf('make the tarball folder')).toBeLessThan(
      labels.indexOf('react: pack the tarball to publish'),
    );
  });

  test('a package published earlier is waited for before the clean-install gate reads it from the registry', async () => {
    const h = healed();
    await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
    const waitAt = h.events.indexOf('wait @venizia/ardor-kernel');
    const installAt = h.events.findIndex((event) => event.includes('clean-install/cli.ts'));

    expect(waitAt).toBeGreaterThan(-1);
    expect(waitAt).toBeLessThan(installAt);
  });

  test('the release branch is made once, also when the first package recorded is only tagged', async () => {
    const h = harness({
      manifests: { kernel: '0.4.6-0' },
      onNpm: ['@venizia/ardor-kernel'],
      tagged: [],
    });
    const result = await runChain({
      options: optionsOf(['kernel', 'react', 'admin'], { branch: 'release-7' }),
      ports: h.ports,
    });
    const commands = h.commands();

    expect(result.ok).toBe(true);
    expect(commands.filter((command) => command === 'git switch -c release-7')).toHaveLength(1);
    expect(indexOfCommand(commands, 'git switch -c release-7')).toBeLessThan(
      indexOfCommand(commands, 'git commit -m chore(react)'),
    );
  });
});

describe('runChain: what each commit holds', () => {
  test('the release stages one package.json and the lockfile, never a whole tree that holds later bumps', async () => {
    const h = harness({});
    await runChain({
      options: optionsOf(['kernel', 'react', 'admin', 'ardor'], { branch: 'release-3' }),
      ports: h.ports,
    });
    const adds = h.commands().filter((command) => command.startsWith('git add'));

    expect(adds).toEqual([
      'git add packages/kernel/package.json bun.lock',
      'git add packages/react/package.json bun.lock',
      'git add packages/admin/package.json bun.lock',
      'git add packages/ardor/package.json bun.lock',
    ]);
    expect(h.commands().filter((command) => /git (add -A|add \.|commit -a)/.test(command))).toEqual(
      [],
    );
  });

  test('the release branch is made once, at run time', async () => {
    const h = harness({});
    await runChain({
      options: optionsOf(['kernel', 'react', 'admin', 'ardor'], { branch: 'release-3' }),
      ports: h.ports,
    });

    expect(h.commands().filter((command) => command.startsWith('git switch -c'))).toEqual([
      'git switch -c release-3',
    ]);
  });
});

// bun writes the exact version of every workspace sibling into the packed manifest. The fake workspace is at 0.4.5.
describe('runChain: the exact pins on the siblings of the run', () => {
  const pinned = (extra: Parameters<typeof harness>[0]) =>
    harness({ scope: 'react', packedDependencies: { '@venizia/ardor-kernel': '0.4.5' }, ...extra });

  test('a pin equal to the version of the sibling in the workspace passes, once the sibling is published', async () => {
    const h = pinned({});
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(true);
    expect(result.states[1]?.pins).toEqual({ '@venizia/ardor-kernel': '0.4.5' });
  });

  test('a pin that is not the version the workspace has stops the run before anything is published', async () => {
    const h = pinned({ packedDependencies: { '@venizia/ardor-kernel': '0.4.4' } });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(result.report).toContain(
      '@venizia/ardor-kernel is pinned 0.4.4, the workspace has 0.4.5',
    );
    expect(indexOfCommand(h.commands(), 'npm publish')).toBe(-1);
  });

  test('a wrong pin in the peers is not hidden by a right pin in the dependencies of the same name', async () => {
    const h = pinned({ packedPeerDependencies: { '@venizia/ardor-kernel': '0.4.4' } });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(result.report).toContain(
      '@venizia/ardor-kernel is pinned 0.4.4, the workspace has 0.4.5',
    );
  });

  test('a package that depends on one released after it stops the run before anything is published', async () => {
    const h = harness({
      scope: 'kernel',
      packedDependencies: { '@venizia/ardor-react': '0.4.5' },
    });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(result.report).toContain('released after this package, but this package depends on it');
    expect(indexOfCommand(h.commands(), 'npm publish')).toBe(-1);
  });

  test('a sibling outside the run must be on npm, or the package is not published', async () => {
    const missing = pinned({});
    const stopped = await runChain({ options: optionsOf(['react']), ports: missing.ports });

    expect(stopped.ok).toBe(false);
    expect(stopped.report).toContain('@venizia/ardor-kernel@0.4.5 is not on npm');
    expect(indexOfCommand(missing.commands(), 'react.tgz --access public')).toBe(-1);

    const served = pinned({ onNpm: ['@venizia/ardor-kernel'] });
    const passed = await runChain({ options: optionsOf(['react']), ports: served.ports });

    expect(passed.ok).toBe(true);
  });

  test('a sibling of the run whose publish failed is never relied on', async () => {
    const h = harness({
      packedDependencies: { '@venizia/ardor-kernel': '0.4.5' },
      scope: 'kernel',
      fail: (command) => command.includes('kernel.tgz --access public'),
    });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(indexOfCommand(h.commands(), 'react.tgz --access public')).toBe(-1);
  });
});

describe('runChain: steps that never stop the chain', () => {
  test('a failing highest tag or heal is a warning, and the chain goes on', async () => {
    const h = harness({
      fail: (command) => command.includes('tag-highest') || command.includes('heal-next'),
    });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(true);
    expect(result.states[0]?.warnings).toHaveLength(2);
    expect(result.states[1]?.stage).toBe('tagged');
  });
});

describe('ReleaseChain.report', () => {
  const states = [
    {
      name: 'kernel',
      packageName: '@venizia/ardor-kernel',
      stage: 'tagged' as const,
      skipped: false,
      warnings: [],
    },
    {
      name: 'react',
      packageName: '@venizia/ardor-react',
      stage: 'none' as const,
      skipped: false,
      warnings: [],
    },
  ];

  test('it names the package, the step, who is done and the repair', () => {
    const report = ReleaseChain.report({
      states,
      failed: states[1] as (typeof states)[number],
      label: 'react: build',
      version: '0.4.6-0',
      detail: 'exit 1',
    });

    expect(report).toContain('stopped at "react: build": exit 1');
    expect(report).toContain('Done: kernel.');
    expect(report).toContain('Stopped in: react (@venizia/ardor-react@0.4.6-0)');
    expect(report).toContain('same version');
  });
});

describe('the state file and the report read back from it', () => {
  test('a stop writes the step it stopped at, with the packages, to the state file', async () => {
    const h = harness({ fail: (command) => command.includes('npm publish') });
    await runChain({
      options: optionsOf(['kernel'], { statePath: '/work/state.json' }),
      ports: h.ports,
    });
    const written = JSON.parse(h.states.at(-1) as string);

    expect(written.version).toBe('0.4.6-0');
    expect(written.stopped).toEqual({
      failed: 'kernel',
      label: 'kernel: publish',
      detail: 'exit 1',
    });
    expect(written.states[0].stage).toBe('attempted');
  });

  test('a clean run writes no stop', async () => {
    const h = harness({});
    await runChain({
      options: optionsOf(['kernel'], { statePath: '/work/state.json' }),
      ports: h.ports,
    });

    expect(JSON.parse(h.states.at(-1) as string).stopped).toBeUndefined();
  });

  test('the report of a stop is the one the chain printed', async () => {
    const h = harness({ fail: (command) => command.includes('npm publish') });
    const result = await runChain({
      options: optionsOf(['kernel'], { statePath: '/work/state.json' }),
      ports: h.ports,
    });
    const state = JSON.parse(h.states.at(-1) as string);

    expect(ReleaseChain.reportFromState({ state })).toBe(result.report as string);
  });

  test('a job that ended mid-run names the package left half done and says why it is unknown', () => {
    const report = ReleaseChain.reportFromState({
      state: {
        version: '0.4.6-0',
        states: [
          {
            name: 'kernel',
            packageName: NAMES.kernel as string,
            stage: 'tagged',
            skipped: false,
            warnings: [],
          },
          {
            name: 'react',
            packageName: NAMES.react as string,
            stage: 'published',
            skipped: false,
            warnings: [],
          },
        ],
      },
    });

    expect(report).toContain('the job ended before the run finished');
    expect(report).toContain('Done: kernel');
    expect(report).toContain('@venizia/ardor-react@0.4.6-0 is published but not committed');
  });

  test('a run with nothing half done says so', () => {
    const report = ReleaseChain.reportFromState({
      state: {
        version: '0.4.6-0',
        states: [
          {
            name: 'kernel',
            packageName: NAMES.kernel as string,
            stage: 'tagged',
            skipped: false,
            warnings: [],
          },
        ],
      },
    });

    expect(report).toBe('No package was left half done (1 of 1 released at 0.4.6-0).');
  });
});

describe('the tarball folder', () => {
  test('the first package makes it before it packs, the next ones do not', () => {
    const { phaseP } = ReleaseChain.plan({ options: optionsOf(['kernel', 'react']) });
    const labels = phaseP.map((step) => step.label);

    expect(labels.filter((label) => label === 'make the tarball folder')).toHaveLength(1);
    expect(labels.indexOf('make the tarball folder')).toBeLessThan(
      labels.indexOf('kernel: pack the tarball to publish'),
    );
    expect(labels[0]).toBe('make the tarball folder');
  });
});

const stableOptions = (names: string[], extra: Partial<IChainOptions> = {}): IChainOptions =>
  optionsOf(names, { version: '0.4.9', npmTag: 'latest', targetBranch: 'main', ...extra });

const aWorkspaceAfterASync = (names: string[]): Record<string, string> =>
  Object.fromEntries(names.map((name) => [name, '0.4.9-1']));

describe('ReleaseChain for a stable (C2.1, C3.2a, S4.3, S4.4)', () => {
  const names = ['kernel', 'react', 'admin', 'ardor'];
  const stable = ReleaseChain.plan({ options: stableOptions(names) });
  const prerelease = ReleaseChain.plan({ options: optionsOf(names) });
  const commandOf = (steps: typeof stable.phaseR, label: string): string[] => {
    const step = steps.find((candidate) => candidate.label === label);

    return step !== undefined && 'command' in step ? step.command : [];
  };

  test('the npm tag is latest for a stable and next for a prerelease', () => {
    expect(commandOf(stable.phaseB, 'react: publish')).toContain('latest');
    expect(commandOf(prerelease.phaseB, 'react: publish')).toContain('next');
  });

  test('a stable pushes its release commits to main, a prerelease to develop', () => {
    expect(commandOf(stable.phaseR, 'react: push')).toEqual(['git', 'push', 'origin', 'HEAD:main']);
    expect(commandOf(prerelease.phaseR, 'react: push')).toEqual([
      'git',
      'push',
      'origin',
      'HEAD:develop',
    ]);
  });

  test('a stable checks its packed manifest and its preset for an IGNIS prerelease; a prerelease does not', () => {
    expect(stable.phaseA).toHaveLength(28);
    expect(stable.phaseA.filter((step) => step.label.endsWith(': stable-deps'))).toHaveLength(4);
    expect(commandOf(stable.phaseP, 'ardor: check the preset names only stable versions')).toEqual([
      'bun',
      'scripts/release/release-gates.ts',
      'stable-deps',
      'packages/ardor/dist/presets',
    ]);
    expect(prerelease.phaseA).toHaveLength(24);
    expect(
      prerelease.phaseP.some((step) => step.label.includes('names only stable versions')),
    ).toBe(false);
  });

  test('highest moves through the gate, which only moves it up', () => {
    expect(commandOf(stable.phaseR, 'react: tag highest')).toEqual([
      'bun',
      'scripts/release/release-gates.ts',
      'tag-highest',
      '--published',
      '@venizia/ardor-react@0.4.9',
    ]);
  });

  test('the tag message records what the build used when it is known, and nothing when it is not', () => {
    const withLine = ReleaseChain.plan({
      options: stableOptions(names, {
        builtOn: '@venizia/ignis-kernel=0.4.6, @venizia/ignis-boot=0.4.6',
      }),
    });

    expect(commandOf(withLine.phaseR, 'react: annotate the tag')[5]).toBe(
      '@venizia/ardor-react v0.4.9\nbuilt on: @venizia/ignis-kernel=0.4.6, @venizia/ignis-boot=0.4.6',
    );
    expect(commandOf(stable.phaseR, 'react: annotate the tag')[5]).toBe(
      '@venizia/ardor-react v0.4.9',
    );
  });

  test('a stable has a merge back after the last package; a prerelease has none', () => {
    expect(stable.phaseC.map((step) => step.label)).toEqual(['merge back: main into develop']);
    expect(prerelease.phaseC).toEqual([]);
  });
});

describe('runChain for a stable: the plan binds the run (S4.6)', () => {
  const run = async (extra: Partial<IChainOptions>) => {
    const h = harness({
      manifests: aWorkspaceAfterASync(['kernel']),
      packedVersion: '0.4.9',
      developHolds: true,
    });
    const result = await runChain({ options: stableOptions(['kernel'], extra), ports: h.ports });

    return { result, h };
  };

  test('a plan for another version stops the run before anything runs', async () => {
    const { result, h } = await run({ plan: { version: '0.5.0', kind: 'stable' } });

    expect(result.ok).toBe(false);
    expect(result.report).toContain('the plan approved 0.5.0 but this run would publish 0.4.9');
    expect(h.commands()).toEqual([]);
  });

  test('a plan of another kind stops the run', async () => {
    const { result } = await run({ plan: { version: '0.4.9', kind: 'prerelease' } });

    expect(result.report).toContain('the plan said prerelease but this run is a stable');
  });

  test('a stable aimed at develop, and a prerelease aimed at main, stop the run', async () => {
    const result2 = await run({ targetBranch: 'develop' });
    expect(result2.result.report).toContain('a stable (0.4.9) is released from main, not develop');

    const h = harness({});
    const prerelease = await runChain({
      options: optionsOf(['kernel'], { targetBranch: 'main' }),
      ports: h.ports,
    });

    expect(prerelease.report).toContain(
      'a prerelease (0.4.6-0) is released from develop, not main',
    );
    expect(h.commands()).toEqual([]);
  });

  test('a kind that disagrees with the version stops the run', async () => {
    const result2 = await run({ kind: 'prerelease' });
    expect(result2.result.report).toContain('the kind is prerelease but 0.4.9 is a stable');
  });

  test('a plan that agrees lets the run through', async () => {
    const { result } = await run({ plan: { version: '0.4.9', kind: 'stable' } });

    expect(result.ok).toBe(true);
  });
});

describe('runChain for a stable: the merge back (C3.3b, S4.1)', () => {
  const names = ['kernel', 'react'];
  const releasing = (extra: Parameters<typeof harness>[0] = {}) =>
    harness({
      manifests: aWorkspaceAfterASync(names),
      packedVersion: '0.4.9',
      ...extra,
    });
  const mergeCommands = (commands: string[]): string[] =>
    commands.filter(
      (command) =>
        command.includes('worktree') ||
        command.includes('merge-back') ||
        command.includes('merge-base') ||
        command.startsWith('git fetch origin develop') ||
        command.startsWith('git push origin HEAD:develop'),
    );

  test('after the last tag it merges in a clean worktree of origin/develop with a copy of the script, and pushes develop', async () => {
    const h = releasing();
    const result = await runChain({
      options: stableOptions(names, { statePath: '/work/state.json' }),
      ports: h.ports,
    });
    const commands = h.commands();

    expect(result.ok).toBe(true);
    expect(mergeCommands(commands)).toEqual([
      'git fetch origin develop',
      'git merge-base --is-ancestor abc1234567 origin/develop',
      'git worktree add --detach /work/tmp/merge-back-develop origin/develop',
      'cp scripts/release/merge-back.ts /work/tmp/merge-back-main.ts',
      'bun /work/tmp/merge-back-main.ts apply --from abc1234567 --repo /work/tmp/merge-back-develop --message chore(release): merge main into develop after v0.4.9',
      'git push origin HEAD:develop',
      'git worktree remove /work/tmp/merge-back-develop',
    ]);
    expect(indexOfCommand(commands, 'git fetch origin develop')).toBeGreaterThan(
      indexOfCommand(commands, 'git push origin ardor-v') + 0,
    );
    expect(JSON.parse(h.states.at(-1) as string).mergeBack).toBe('done');
  });

  test('it comes after the tag of the last package', async () => {
    const h = releasing();

    await runChain({ options: stableOptions(names), ports: h.ports });
    const commands = h.commands();
    const lastTag = commands.lastIndexOf('git push origin react-v0.4.9');

    expect(lastTag).toBeGreaterThan(-1);
    expect(indexOfCommand(commands, 'git fetch origin develop')).toBeGreaterThan(lastTag);
  });

  test('it is skipped when develop already holds the last release commit', async () => {
    const h = releasing({ developHolds: true });
    const result = await runChain({
      options: stableOptions(names, { statePath: '/work/state.json' }),
      ports: h.ports,
    });

    expect(result.ok).toBe(true);
    expect(h.commands().some((command) => command.includes('worktree add'))).toBe(false);
    expect(JSON.parse(h.states.at(-1) as string).mergeBack).toBe('done');
  });

  test.each([
    ['the merge stops', 'merge-back-main.ts apply'],
    ['the push to develop is rejected', 'git push origin HEAD:develop'],
  ])(
    'when %s the run ends, the state says none and the report names the repair',
    async (_name, failing) => {
      const h = releasing({ fail: (command) => command.includes(failing) });
      const result = await runChain({
        options: stableOptions(names, { statePath: '/work/state.json' }),
        ports: h.ports,
      });
      const state = JSON.parse(h.states.at(-1) as string);

      expect(result.ok).toBe(false);
      expect(result.report?.startsWith('Report - published, merge back not done.')).toBe(true);
      expect(result.report).toContain('Dispatch the same version again: only the merge back runs.');
      expect(result.report).toContain('git push origin develop');
      expect(state.mergeBack).toBe('none');
      expect(state.stopped.failed).toBe('merge back');
      expect(state.states.every((entry: { stage: string }) => entry.stage === 'tagged')).toBe(true);
      expect(h.commands().at(-1)).toBe('git worktree remove /work/tmp/merge-back-develop');
      expect(ReleaseChain.reportFromState({ state })).toBe(result.report as string);
    },
  );

  test('when every package is already released, the re-dispatch runs only the merge back', async () => {
    const h = releasing({
      manifests: { kernel: '0.4.9', react: '0.4.9' },
      onNpm: ['@venizia/ardor-kernel', '@venizia/ardor-react'],
      tagged: ['kernel-v0.4.9', 'react-v0.4.9'],
    });
    const result = await runChain({ options: stableOptions(names), ports: h.ports });
    const commands = h.commands();

    expect(result.ok).toBe(true);
    expect(commands.some((command) => command.includes('npm publish'))).toBe(false);
    expect(commands.some((command) => command.includes('worktree add'))).toBe(true);
  });

  test('a prerelease never merges back, also when every package is already released', async () => {
    const h = harness({
      manifests: { kernel: '0.4.6-0' },
      onNpm: ['@venizia/ardor-kernel'],
      tagged: ['kernel-v0.4.6-0'],
    });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.ok).toBe(true);
    expect(h.commands()).toEqual([]);
  });

  test('the tag message carries the catalog the build read through the port', async () => {
    const h = releasing({ builtOn: '@venizia/ignis-kernel=0.4.6', developHolds: true });

    await runChain({ options: stableOptions(['kernel']), ports: h.ports });

    expect(
      h.commands().find((command) => command.startsWith('git tag -a kernel-v0.4.9')),
    ).toContain('built on: @venizia/ignis-kernel=0.4.6');
  });
});

describe('ReleaseChain.reportFromState for a stable', () => {
  const tagged = ['kernel', 'react'].map((name) => ({
    name,
    packageName: NAMES[name] as string,
    stage: 'tagged' as const,
    skipped: false,
    warnings: [],
  }));

  test('a stop in a package names the target branch, not develop', () => {
    const text = ReleaseChain.reportFromState({
      state: {
        version: '0.4.9',
        targetBranch: 'main',
        states: [{ ...tagged[0]!, stage: 'committed' }],
        stopped: { failed: 'kernel', label: 'kernel: push' },
      },
    });

    expect(text).toContain('the push to main did not land');
    expect(text).toContain('Pull main');
    expect(text).not.toContain('develop');
  });

  test('a job cancelled in the middle of the packages is not reported as a merge back', () => {
    const text = ReleaseChain.reportFromState({
      state: {
        version: '0.4.9',
        targetBranch: 'main',
        mergeBack: 'none',
        states: [tagged[0]!, { ...tagged[1]!, stage: 'published' }],
      },
    });

    expect(text).not.toContain('merge back not done');
    expect(text).toContain('react');
  });

  test('a job cancelled after the last tag, before the merge back finished, is a merge back report', () => {
    const text = ReleaseChain.reportFromState({
      state: { version: '0.4.9', targetBranch: 'main', mergeBack: 'none', states: tagged },
    });

    expect(text.startsWith('Report - published, merge back not done.')).toBe(true);
  });
});

// #439: the refreshed catalog holds ranges; the built on line of a tag holds the versions, which the stable gate compares.
describe('ReleaseChain.builtOnOf', () => {
  test('each IGNIS entry of the catalog is written as the version its range names', () => {
    expect(
      ReleaseChain.builtOnOf({
        catalog: {
          react: '^19.2.7',
          '@venizia/ignis-kernel': '^0.4.6-0',
          '@venizia/ignis-filter': '~0.4.5-0',
          '@venizia/dev-configs': '0.4.4',
        },
      }),
    ).toBe(
      '@venizia/ignis-kernel=0.4.6-0, @venizia/ignis-filter=0.4.5-0, @venizia/dev-configs=0.4.4',
    );
  });
});
