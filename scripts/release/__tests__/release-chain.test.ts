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
}): IHarness => {
  const events: string[] = [];
  const states: string[] = [];
  const shaCalls: Record<string, number> = {};
  let current = '';
  const inScope = () => opts.scope === undefined || opts.scope === current;

  const ports: IChainPorts = {
    run: async ({ command }) => {
      const text = command.join(' ');
      events.push(`run ${text}`);
      const started = /^make clean-install-(\w+)$/.exec(text);
      if (started) {
        current = started[1] as string;
      }
      if (inScope() && opts.fail?.(text)) {
        return { exitCode: 1, stdout: '' };
      }
      if (text.startsWith('tar -xzOf')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            name: 'x',
            version: (inScope() ? opts.packedVersion : undefined) ?? '0.4.6-0',
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
      if (opts.failWait && inScope()) {
        throw new Error('still 404');
      }
    },
    sha256: async () => {
      shaCalls[current] = (shaCalls[current] ?? 0) + 1;
      return opts.shaChanges && inScope() && (shaCalls[current] ?? 0) > 1 ? 'changed' : 'abc';
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
  const { phaseA, phaseB } = ReleaseChain.plan({
    options: optionsOf(['kernel', 'react', 'admin', 'ardor'], {
      chainReleased: ['@venizia/ardor-kernel'],
    }),
  });
  const labels = (steps: typeof phaseA) => steps.map((step) => step.label);

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

  test('phase B of a package runs in the order of the card', () => {
    const order = labels(phaseB).filter((label) => label.startsWith('react:'));

    expect(order).toEqual([
      'react: clean-install',
      'react: bump',
      'react: pack the tarball to publish',
      'react: check the packed manifest',
      'react: record the sha256',
      'react: check the sha256',
      'react: publish',
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
    const ardor = labels(phaseB).filter((label) => label.startsWith('ardor:'));

    expect(labels(phaseB).filter((label) => label.includes('preset'))).toEqual([
      'ardor: write the VULCAN preset',
    ]);
    expect(ardor.indexOf('ardor: bump')).toBeLessThan(ardor.length);
    const all = labels(phaseB);
    expect(all.indexOf('ardor: bump')).toBeLessThan(all.indexOf('ardor: write the VULCAN preset'));
    expect(all.indexOf('ardor: write the VULCAN preset')).toBeLessThan(
      all.indexOf('ardor: pack the tarball to publish'),
    );
  });

  test('the publish is a provenance publish of an absolute tarball, with the dist-tag', () => {
    const publish = phaseB.find((step) => step.label === 'kernel: publish');

    expect(publish && ReleaseChain.describe({ step: publish })).toBe(
      'kernel: publish: npm publish /work/tarballs/kernel.tgz --access public --tag next --ignore-scripts --provenance',
    );
  });

  test('the chain never pulls or rebases', () => {
    const everything = [...phaseA, ...phaseB]
      .map((step) => ReleaseChain.describe({ step }))
      .join('\n');

    expect(everything).not.toContain('git pull');
    expect(everything).not.toContain('rebase');
  });

  test('the release branch is made once, before the first commit', () => {
    const { phaseB: withBranch } = ReleaseChain.plan({
      options: optionsOf(['kernel', 'react'], { branch: 'release-42' }),
    });
    const switches = labels(withBranch).filter((label) => label === 'switch to the release branch');

    expect(switches).toHaveLength(1);
    expect(labels(withBranch).indexOf('switch to the release branch')).toBeLessThan(
      labels(withBranch).indexOf('kernel: commit'),
    );
  });

  test('the commit subject carries the issue and the version', () => {
    const { phaseB: withIssue } = ReleaseChain.plan({
      options: optionsOf(['kernel'], { issue: '412' }),
    });
    const commit = withIssue.find((step) => step.label === 'kernel: commit');

    expect(commit && 'command' in commit && commit.command.at(-1)).toBe(
      '[#412] chore(kernel): release v0.4.6-0 [0.4.6-0]',
    );
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

  test('each package is waited for, committed, pushed and tagged before the next one starts', async () => {
    const h = harness({});
    await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
    const e = h.events;
    const at = (text: string, from = 0) =>
      e.findIndex((event, index) => index >= from && event.includes(text));

    const kernelWait = at('wait @venizia/ardor-kernel');
    const kernelCommit = at('git commit -m chore(kernel)');
    const kernelPush = at('git push origin HEAD:develop', kernelCommit);
    const kernelTag = at('git push origin kernel-v0.4.6-0');
    const reactInstall = at('make clean-install-react');
    const reactPublish = at('react.tgz --access public');

    expect(kernelWait).toBeGreaterThan(at('kernel.tgz --access public'));
    expect(kernelCommit).toBeGreaterThan(kernelWait);
    expect(kernelPush).toBeGreaterThan(kernelCommit);
    expect(kernelTag).toBeGreaterThan(kernelPush);
    expect(reactInstall).toBeGreaterThan(kernelTag);
    expect(reactPublish).toBeGreaterThan(reactInstall);
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

  test('on npm with the manifest below the version: stop before changing anything', async () => {
    const h = harness({ onNpm: ['@venizia/ardor-react'] });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(h.commands()).toEqual([]);
    expect(result.report).toContain(
      '@venizia/ardor-react@0.4.6-0 is on npm but the manifest is at 0.4.5',
    );
    expect(result.report).toContain('npm version 0.4.6-0 --no-git-tag-version');
  });

  test('the manifest at the version but not on npm: stop and say so', async () => {
    const h = harness({ manifests: { kernel: '0.4.6-0' } });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(h.commands()).toEqual([]);
    expect(result.report).toContain('a bump without a publish');
  });

  test('the manifest at the version, on npm, the tag missing: stop with the tag repair', async () => {
    const h = harness({ manifests: { kernel: '0.4.6-0' }, onNpm: ['@venizia/ardor-kernel'] });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.ok).toBe(false);
    expect(result.report).toContain('only the tag is missing');
    expect(result.report).toContain('git tag -a kernel-v0.4.6-0');
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

  const phaseBSteps = ReleaseChain.plan({ options: optionsOf(['kernel', 'react']) })
    .phaseB.filter((step) => step.label.startsWith('react:'))
    .filter((step) => !('fatal' in step) || step.fatal)
    .filter((step) => step.kind !== 'record-sha' && step.kind !== 'push-tag');

  for (const step of phaseBSteps) {
    test(`a failure at "${step.label}" leaves kernel done and runs nothing of react after it`, async () => {
      const failCommand = 'command' in step ? step.command.join(' ') : undefined;
      const h = harness({
        scope: 'react',
        fail: (command) => command === failCommand,
        failWait: step.kind === 'wait',
        shaChanges: step.kind === 'verify-sha',
        packedVersion: step.kind === 'manifest' ? '9.9.9' : undefined,
      });
      const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });

      expect(result.ok).toBe(false);
      expect(result.states.map((state) => state.stage)[0]).toBe('tagged');
      const events = h.events;
      const reactIndex = events.findIndex((event) => event.includes('make clean-install-react'));
      const stopped = events.length;
      // Nothing of a later package exists: react is the last one, so the log ends with the failed step.
      expect(reactIndex).toBeGreaterThan(-1);
      expect(stopped).toBeGreaterThan(reactIndex);
      expect(indexOfCommand(h.commands(), 'git push origin react-v0.4.6-0')).toBe(-1);
    });
  }

  test('a rejected push stops the run with no pull and no rebase, and the report says so', async () => {
    const h = harness({ fail: (command) => command === 'git push origin HEAD:develop' });
    const result = await runChain({ options: optionsOf(['kernel', 'react']), ports: h.ports });
    const commands = h.commands();

    expect(result.ok).toBe(false);
    expect(result.states[0]?.stage).toBe('committed');
    expect(
      commands.some((command) => command.includes('git pull') || command.includes('rebase')),
    ).toBe(false);
    expect(indexOfCommand(commands, 'react.tgz')).toBe(-1);
    expect(result.report).toContain('the push to develop did not land');
  });

  test('a failing publish is reported as attempted, outcome unknown', async () => {
    const h = harness({ fail: (command) => command.includes('npm publish') });
    const result = await runChain({ options: optionsOf(['kernel']), ports: h.ports });

    expect(result.states[0]?.stage).toBe('attempted');
    expect(result.report).toContain('its outcome is unknown');
    expect(result.report).toContain('npm view @venizia/ardor-kernel versions');
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

describe('runChain: steps that never stop the chain', () => {
  test('a failing highest tag or heal is a warning, and the chain goes on', async () => {
    const h = harness({
      fail: (command) => command.includes('dist-tag add') || command.includes('heal-next'),
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
    expect(report).toContain('--version');
  });
});
