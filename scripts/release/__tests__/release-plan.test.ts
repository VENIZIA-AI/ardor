import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { makeScratch } from '../../scratch';
import { ReleasePlan, type IPlannedPackage } from '../release-plan';

const ROOT = resolve(import.meta.dir, '..', '..', '..');

const at = (version: string) =>
  ReleasePlan.ORDER.map((name) => ({ name: name as string, localVersion: version }));

describe('ReleasePlan.validate', () => {
  test('the whole order and an in-order selection pass', () => {
    expect(() =>
      ReleasePlan.validate({ packages: ['kernel', 'react', 'admin', 'ardor'] }),
    ).not.toThrow();
    expect(() => ReleasePlan.validate({ packages: ['react', 'ardor'] })).not.toThrow();
    expect(() => ReleasePlan.validate({ packages: ['ardor'] })).not.toThrow();
  });

  test('an empty plan fails', () => {
    expect(() => ReleasePlan.validate({ packages: [] })).toThrow('the plan is empty');
  });

  test('an unknown package fails and is named', () => {
    expect(() => ReleasePlan.validate({ packages: ['kernel', 'ui-kit'] })).toThrow(
      'unknown package(s): ui-kit',
    );
  });

  test('a repeated package fails', () => {
    expect(() => ReleasePlan.validate({ packages: ['kernel', 'kernel', 'react'] })).toThrow(
      'repeated package(s): kernel',
    );
  });

  test('a package out of dependency order fails', () => {
    expect(() => ReleasePlan.validate({ packages: ['ardor', 'kernel'] })).toThrow(
      'not in dependency order',
    );
    expect(() => ReleasePlan.validate({ packages: ['react', 'kernel', 'admin'] })).toThrow(
      'not in dependency order',
    );
  });
});

describe('ReleasePlan.increment', () => {
  // The expected versions are what `npm version <mode> --no-git-tag-version` prints for each current
  // version; they are listed by hand here so the test does not run npm.
  const cases: Array<[current: string, mode: string, expected: string]> = [
    ['0.4.5', 'patch', '0.4.6'],
    ['0.4.5', 'minor', '0.5.0'],
    ['0.4.5', 'major', '1.0.0'],
    ['0.4.5', 'prerelease', '0.4.6-0'],
    ['0.4.5', 'prepatch', '0.4.6-0'],
    ['0.4.5', 'preminor', '0.5.0-0'],
    ['0.4.5', 'premajor', '1.0.0-0'],
    ['0.4.8-3', 'prerelease', '0.4.8-4'],
    ['0.4.8-3', 'patch', '0.4.8'],
    ['0.4.8-3', 'minor', '0.5.0'],
    ['0.4.8-3', 'major', '1.0.0'],
    ['0.4.8-3', 'prepatch', '0.4.9-0'],
    ['0.4.8-9', 'prerelease', '0.4.8-10'],
    ['0.4.0-3', 'minor', '0.4.0'],
    ['0.4.0-3', 'major', '1.0.0'],
    ['1.0.0-2', 'major', '1.0.0'],
    ['0.4.9-1', 'patch', '0.4.9'],
    ['0.4.8-beta', 'prerelease', '0.4.8-beta.0'],
  ];

  for (const [current, mode, expected] of cases) {
    test(`${current} + ${mode} gives ${expected}`, () => {
      expect(ReleasePlan.increment({ current, mode })).toBe(expected);
    });
  }

  test('the first prerelease after a stable ends in -0, the next ones count up', () => {
    const first = ReleasePlan.increment({ current: '0.4.8', mode: 'prerelease' });
    const second = ReleasePlan.increment({ current: first, mode: 'prerelease' });

    expect([first, second]).toEqual(['0.4.9-0', '0.4.9-1']);
  });

  test('0.4.8-2 sorts below 0.4.8-10, which sorts below 0.4.8', () => {
    expect(Bun.semver.order('0.4.8-2', '0.4.8-10')).toBe(-1);
    expect(Bun.semver.order('0.4.8-10', '0.4.8')).toBe(-1);
  });

  test('an unknown mode and a malformed version fail', () => {
    expect(() => ReleasePlan.increment({ current: '0.4.5', mode: 'banana' })).toThrow(
      'unknown mode',
    );
    expect(() => ReleasePlan.increment({ current: '0.4', mode: 'patch' })).toThrow('not a version');
    expect(() => ReleasePlan.increment({ current: '0.4.5+build', mode: 'patch' })).toThrow(
      'not a version',
    );
  });
});

describe('ReleasePlan.resolveVersion', () => {
  test('a mode over four packages at one version gives one version and the whole plan', () => {
    const run = ReleasePlan.resolveVersion({ target: 'prerelease', packages: at('0.4.5') });

    expect(run).toEqual({
      version: '0.4.6-0',
      plan: ['kernel', 'react', 'admin', 'ardor'],
      skipped: [],
    });
  });

  test('a mode over packages at different versions fails and names them and --version', () => {
    const packages = at('0.4.5');
    packages[0] = { name: 'kernel', localVersion: '0.4.6-0' };

    expect(() => ReleasePlan.resolveVersion({ target: 'patch', packages })).toThrow(
      'kernel 0.4.6-0, react 0.4.5, admin 0.4.5, ardor 0.4.5',
    );
    expect(() => ReleasePlan.resolveVersion({ target: 'patch', packages })).toThrow('--version');
  });

  test('an explicit version plans the packages below it and skips the ones at it', () => {
    const packages = at('0.4.5');
    packages[0] = { name: 'kernel', localVersion: '0.4.6-0' };
    packages[1] = { name: 'react', localVersion: '0.4.6-0' };

    expect(ReleasePlan.resolveVersion({ target: '0.4.6-0', packages })).toEqual({
      version: '0.4.6-0',
      plan: ['admin', 'ardor'],
      skipped: ['kernel', 'react'],
    });
  });

  test('an explicit version below a package fails', () => {
    const packages = at('0.4.5');
    packages[3] = { name: 'ardor', localVersion: '0.5.0' };

    expect(() => ReleasePlan.resolveVersion({ target: '0.4.6', packages })).toThrow(
      'ardor is at 0.5.0, above 0.4.6',
    );
  });

  test('a plan out of order fails before any version is read', () => {
    expect(() =>
      ReleasePlan.resolveVersion({
        target: 'patch',
        packages: [
          { name: 'ardor', localVersion: '0.4.5' },
          { name: 'kernel', localVersion: '0.4.5' },
        ],
      }),
    ).toThrow('not in dependency order');
  });
});

describe('ReleasePlan.dispatch', () => {
  test('a plan gives one dispatch of the workflow on develop', () => {
    const dispatch = ReleasePlan.dispatch({
      plan: ['kernel', 'react', 'admin', 'ardor'],
      version: '0.4.6-0',
    });

    expect(dispatch).toEqual({
      workflow: 'package-release.yml',
      ref: 'develop',
      inputs: { packages: 'kernel,react,admin,ardor', version: '0.4.6-0' },
    });
  });

  test('the argument list sends exactly one gh workflow run, with the ref and each input', () => {
    const dispatch = ReleasePlan.dispatch({
      plan: ['admin', 'ardor'],
      version: '0.4.6-0',
      issue: '412',
    });

    expect(ReleasePlan.dispatchArgs({ dispatch })).toEqual([
      'gh',
      'workflow',
      'run',
      'package-release.yml',
      '--ref',
      'develop',
      '-f',
      'packages=admin,ardor',
      '-f',
      'version=0.4.6-0',
      '-f',
      'issue=412',
    ]);
  });

  test('describe prints the one dispatch', () => {
    const dispatch = ReleasePlan.dispatch({ plan: ['kernel', 'react'], version: '0.4.6' });

    expect(ReleasePlan.describe({ dispatch })).toBe(
      '1 dispatch of package-release.yml on develop: packages=kernel,react version=0.4.6',
    );
  });

  test('a plan that is not valid is not dispatched', () => {
    expect(() => ReleasePlan.dispatch({ plan: ['react', 'kernel'], version: '0.4.6' })).toThrow(
      'not in dependency order',
    );
  });
});

describe('release.ts', () => {
  test('importing it releases nothing and prints nothing', () => {
    const proc = Bun.spawnSync(
      ['bun', '-e', `await import(${JSON.stringify(join(ROOT, 'scripts/release/release.ts'))})`],
      { cwd: ROOT },
    );

    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
    expect(proc.stderr.toString()).toBe('');
  });
});

describe('ReleasePlan.resolveFromManifests', () => {
  const scratch = (versions: Record<string, string>): string => {
    const root = makeScratch({ prefix: 'release-plan-' });
    for (const [name, version] of Object.entries(versions)) {
      mkdirSync(join(root, 'packages', name), { recursive: true });
      writeFileSync(join(root, 'packages', name, 'package.json'), JSON.stringify({ version }));
    }
    scratches.push(root);

    return root;
  };
  const scratches: string[] = [];
  const all = (version: string) => ({
    kernel: version,
    react: version,
    admin: version,
    ardor: version,
  });

  afterAll(() => {
    for (const root of scratches) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a mode over four packages at one version gives the one version', () => {
    const root = scratch(all('0.4.5'));

    expect(
      ReleasePlan.resolveFromManifests({
        root,
        argv: ['--packages', 'kernel,react,admin,ardor', '--version', '', '--mode', 'prerelease'],
      }),
    ).toBe('0.4.6-0');
  });

  test('a mode over packages at different versions fails and names --version', () => {
    const root = scratch({ ...all('0.4.5'), kernel: '0.4.6-0' });

    expect(() =>
      ReleasePlan.resolveFromManifests({
        root,
        argv: ['--packages', 'kernel,react,admin,ardor', '--mode', 'patch'],
      }),
    ).toThrow('--version');
  });

  test('an explicit version is the version, and a package above it fails', () => {
    const root = scratch({ ...all('0.4.5'), ardor: '0.5.0' });

    expect(
      ReleasePlan.resolveFromManifests({
        root,
        argv: ['--packages', 'kernel,react', '--version', '0.4.6'],
      }),
    ).toBe('0.4.6');
    expect(() =>
      ReleasePlan.resolveFromManifests({
        root,
        argv: ['--packages', 'ardor', '--version', '0.4.6'],
      }),
    ).toThrow('ardor is at 0.5.0, above 0.4.6');
  });

  test('a list out of dependency order fails before any manifest is read', () => {
    expect(() =>
      ReleasePlan.resolveFromManifests({
        root: '/nowhere',
        argv: ['--packages', 'react,kernel', '--mode', 'patch'],
      }),
    ).toThrow('not in dependency order');
  });
});

const MAIN = 'refs/heads/main';
const DEVELOP = 'refs/heads/develop';
const ALL = ['kernel', 'react', 'admin', 'ardor'];

describe('ReleasePlan.kindOf and checkRef', () => {
  test('a version with a prerelease part is a prerelease, anything else a stable', () => {
    expect(ReleasePlan.kindOf({ version: '0.4.9-0' })).toBe('prerelease');
    expect(ReleasePlan.kindOf({ version: '0.4.9' })).toBe('stable');
  });

  test.each([
    [DEVELOP, 'prerelease', []],
    [MAIN, 'stable', []],
    [MAIN, 'prerelease', ['a prerelease runs from develop, not main']],
    [DEVELOP, 'stable', ['a stable release runs from main, not develop']],
  ] as const)('%s with a %s version: %j', (ref, kind, expected) => {
    expect(ReleasePlan.checkRef({ ref, kind })).toEqual([...expected]);
  });

  test('another ref is refused', () => {
    expect(ReleasePlan.checkRef({ ref: 'refs/heads/feature/x', kind: 'prerelease' })[0]).toContain(
      'not refs/heads/feature/x',
    );
  });
});

describe('ReleasePlan.plan (C2.2-a, C3.1a, C3.1b, C3.8)', () => {
  const planOf = (opts: { target: string; versions: string | string[]; ref: string }) => {
    const packages: IPlannedPackage[] = ALL.map((name, index) => ({
      name,
      localVersion: Array.isArray(opts.versions) ? (opts.versions[index] ?? '') : opts.versions,
    }));

    return ReleasePlan.plan({ target: opts.target, packages, ref: opts.ref });
  };

  test.each(['patch', 'minor', 'major'])(
    'the stable bump %s over a prerelease on main is accepted, and the four are planned',
    (mode) => {
      const result = planOf({ target: mode, versions: '0.4.9-1', ref: MAIN });

      expect(result.problems).toEqual([]);
      expect(result.plan?.kind).toBe('stable');
      expect(result.plan?.npmTag).toBe('latest');
      expect(result.plan?.catalogTag).toBe('latest');
      expect(result.plan?.packages).toEqual(ALL);
    },
  );

  test('the resolved version is the promotion: 0.4.9-1 gives 0.4.9, 0.5.0, 1.0.0; 0.4.0-3 and minor give 0.4.0', () => {
    expect(planOf({ target: 'patch', versions: '0.4.9-1', ref: MAIN }).plan?.version).toBe('0.4.9');
    expect(planOf({ target: 'minor', versions: '0.4.9-1', ref: MAIN }).plan?.version).toBe('0.5.0');
    expect(planOf({ target: 'major', versions: '0.4.9-1', ref: MAIN }).plan?.version).toBe('1.0.0');
    expect(planOf({ target: 'minor', versions: '0.4.0-3', ref: MAIN }).plan?.version).toBe('0.4.0');
  });

  test.each(['prerelease', 'prepatch', 'preminor', 'premajor'])(
    'the prerelease mode %s runs on develop and never on main',
    (mode) => {
      const onDevelop = planOf({ target: mode, versions: '0.4.9-1', ref: DEVELOP });
      const onMain = planOf({ target: mode, versions: '0.4.9-1', ref: MAIN });

      expect(onDevelop.problems).toEqual([]);
      expect(onDevelop.plan?.npmTag).toBe('next');
      expect(onDevelop.plan?.catalogTag).toBe('highest');
      expect(onMain.problems).toEqual(['a prerelease runs from develop, not main']);
    },
  );

  test.each(['patch', 'minor', 'major'])('the stable bump %s on develop is refused', (mode) => {
    expect(planOf({ target: mode, versions: '0.4.9-1', ref: DEVELOP }).problems).toEqual([
      'a stable release runs from main, not develop',
    ]);
  });

  test('a stable bump over a stable on main is refused: nothing to promote', () => {
    const { problems } = planOf({ target: 'patch', versions: '0.4.9', ref: MAIN });

    expect(problems[0]).toContain('nothing to promote');
    expect(problems[0]).toContain('0.4.9');
  });

  test('an explicit stable is accepted over the prerelease it promotes and refused over any other', () => {
    expect(planOf({ target: '0.4.9', versions: '0.4.9-1', ref: MAIN }).problems).toEqual([]);
    expect(planOf({ target: '0.5.0', versions: '0.4.9-1', ref: MAIN }).problems).toEqual([]);

    const refused = planOf({ target: '0.4.10', versions: '0.4.9-1', ref: MAIN });
    expect(refused.problems[0]).toContain('is not the promotion of a prerelease');
    expect(refused.problems[0]).toContain('kernel is at 0.4.9-1');
  });

  test('a run that stopped half way is accepted by its version: the packages below it are planned', () => {
    const result = planOf({
      target: '0.4.9',
      versions: ['0.4.9', '0.4.9', '0.4.9-1', '0.4.9-1'],
      ref: MAIN,
    });

    expect(result.problems).toEqual([]);
    expect(result.plan?.packages).toEqual(['admin', 'ardor']);
    expect(result.plan?.skipped).toEqual(['kernel', 'react']);
  });

  test('every package already at the version gives an empty plan that is still accepted', () => {
    const result = planOf({ target: '0.4.9', versions: '0.4.9', ref: MAIN });

    expect(result.problems).toEqual([]);
    expect(result.plan?.packages).toEqual([]);
    expect(result.plan?.skipped).toEqual(ALL);
  });

  test('packages at different versions under a mode are refused', () => {
    const { plan, problems } = planOf({
      target: 'patch',
      versions: ['0.4.9-1', '0.4.9-1', '0.4.9-2', '0.4.9-1'],
      ref: MAIN,
    });

    expect(plan).toBeUndefined();
    expect(problems[0]).toContain('different versions');
  });

  test('an explicit stable version over a stable below it is refused: it was never a prerelease', () => {
    expect(planOf({ target: '0.4.9', versions: '0.4.8', ref: MAIN }).problems[0]).toContain(
      'is not the promotion of a prerelease',
    );
  });

  test('an issue that is not a number is refused', () => {
    const packages = ALL.map((name) => ({ name, localVersion: '0.4.9-1' }));

    expect(
      ReleasePlan.plan({ target: 'prerelease', packages, ref: DEVELOP, issue: '--x' }).problems,
    ).toEqual(["the issue must be a number, not '--x'"]);
  });
});

describe('ReleasePlan.checkBuiltOn (S4.2)', () => {
  const message =
    'ardor v0.4.9-1\nbuilt on: @venizia/ignis-kernel=0.4.6-1, @venizia/ignis-boot=0.4.6-1';
  const latest = (versions: Record<string, string | undefined>) => async (opts: { name: string }) =>
    versions[opts.name];

  test('the prerelease tag is the last planned package that is still a prerelease', () => {
    expect(
      ReleasePlan.prereleaseTagOf({
        packages: [
          { name: 'admin', localVersion: '0.4.9-1' },
          { name: 'ardor', localVersion: '0.4.9-1' },
        ],
      }),
    ).toBe('ardor-v0.4.9-1');
    expect(
      ReleasePlan.prereleaseTagOf({ packages: [{ name: 'ardor', localVersion: '0.4.9' }] }),
    ).toBeUndefined();
  });

  test('the built on line is parsed into name and version pairs', () => {
    expect(ReleasePlan.parseBuiltOn({ message })).toEqual([
      { name: '@venizia/ignis-kernel', version: '0.4.6-1' },
      { name: '@venizia/ignis-boot', version: '0.4.6-1' },
    ]);
    expect(ReleasePlan.parseBuiltOn({ message: 'ardor v0.4.9-1' })).toEqual([]);
  });

  test('it passes when every latest is at least what the prerelease was built on', async () => {
    expect(
      await ReleasePlan.checkBuiltOn({
        tag: 'ardor-v0.4.9-1',
        message,
        latestOf: latest({ '@venizia/ignis-kernel': '0.4.6', '@venizia/ignis-boot': '0.4.7' }),
      }),
    ).toEqual([]);
  });

  test('it names a package whose latest is below', async () => {
    const problems = await ReleasePlan.checkBuiltOn({
      tag: 'ardor-v0.4.9-1',
      message,
      latestOf: latest({ '@venizia/ignis-kernel': '0.4.5', '@venizia/ignis-boot': '0.4.6' }),
    });

    expect(problems).toEqual([
      'IGNIS stable is not out: @venizia/ignis-kernel latest 0.4.5, the prerelease was built on 0.4.6-1',
    ]);
  });

  test('it names a package with no latest', async () => {
    const problems = await ReleasePlan.checkBuiltOn({
      tag: 'ardor-v0.4.9-1',
      message,
      latestOf: latest({ '@venizia/ignis-kernel': '0.4.6' }),
    });

    expect(problems).toEqual([
      'IGNIS stable is not out: @venizia/ignis-boot has no latest, the prerelease was built on 0.4.6-1',
    ]);
  });

  test('a tag with no built on line, or no message, is refused', async () => {
    for (const noLine of ['ardor v0.4.9-1', undefined]) {
      const problems = await ReleasePlan.checkBuiltOn({
        tag: 'ardor-v0.4.9-1',
        message: noLine,
        latestOf: latest({}),
      });

      expect(problems[0]).toContain('has no');
      expect(problems[0]).toContain('built on');
    }
  });
});

describe('release-plan.ts plan', () => {
  const scratches: string[] = [];
  const dispatch = (opts: { versions: string; argv: string[] }) => {
    const root = makeScratch({ prefix: 'release-plan-cli-' });
    scratches.push(root);
    for (const name of ALL) {
      mkdirSync(join(root, 'packages', name), { recursive: true });
      writeFileSync(
        join(root, 'packages', name, 'package.json'),
        JSON.stringify({ version: opts.versions }),
      );
    }
    const output = join(root, 'output.txt');
    const proc = Bun.spawnSync(
      [
        'bun',
        join(ROOT, 'scripts/release/release-plan.ts'),
        'plan',
        '--packages',
        ALL.join(','),
        ...opts.argv,
      ],
      { cwd: root, env: { ...process.env, GITHUB_OUTPUT: output } },
    );

    return {
      code: proc.exitCode,
      stdout: proc.stdout.toString(),
      stderr: proc.stderr.toString(),
      outputPath: output,
    };
  };

  afterAll(() => {
    for (const root of scratches) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a prerelease on develop prints the plan and writes the job outputs', async () => {
    const result = dispatch({
      versions: '0.4.9-1',
      argv: ['--mode', 'prerelease', '--ref', DEVELOP],
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(
      'plan: 0.4.9-2 (prerelease) from prerelease on refs/heads/develop',
    );
    expect(await Bun.file(result.outputPath).text()).toBe(
      'version=0.4.9-2\nkind=prerelease\nnpm_tag=next\ncatalog_tag=highest\ndevelop_sha=\n',
    );
  });

  test('a stable on develop exits 1 with the reason and writes no output', async () => {
    const result = dispatch({ versions: '0.4.9-1', argv: ['--mode', 'patch', '--ref', DEVELOP] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ERROR | a stable release runs from main, not develop');
    expect(await Bun.file(result.outputPath).exists()).toBe(false);
  });
});

describe('the driver picks the branch by the kind of the target (C1.5c)', () => {
  const refOf = (target: string): string => {
    const kind = ReleasePlan.kindOfTarget({ target });
    const dispatch = ReleasePlan.dispatch({
      plan: ALL,
      version: '0.4.9',
      ref: ReleasePlan.branchOf({ kind }),
    });

    return (
      ReleasePlan.dispatchArgs({ dispatch })[
        ReleasePlan.dispatchArgs({ dispatch }).indexOf('--ref') + 1
      ] ?? ''
    );
  };

  test.each(['patch', 'minor', 'major', '0.4.9', '1.0.0'])(
    '%s is a stable: --ref main',
    (target) => {
      expect(ReleasePlan.kindOfTarget({ target })).toBe('stable');
      expect(refOf(target)).toBe('main');
    },
  );

  test.each(['prerelease', 'prepatch', 'preminor', 'premajor', '0.4.9-0', '1.0.0-rc.1'])(
    '%s is a prerelease: --ref develop',
    (target) => {
      expect(ReleasePlan.kindOfTarget({ target })).toBe('prerelease');
      expect(refOf(target)).toBe('develop');
    },
  );

  test('the dispatch carries the ref it is given, and describe names it', () => {
    const dispatch = ReleasePlan.dispatch({ plan: ALL, version: '0.4.9', ref: 'main' });

    expect(dispatch.ref).toBe('main');
    expect(ReleasePlan.describe({ dispatch })).toContain('on main:');
  });

  test('release-scope.ts is gone: no script imports it (C3.8)', () => {
    const found = Bun.spawnSync(['grep', '-rl', 'release-scope', 'scripts', '--include=*.ts'], {
      cwd: ROOT,
    });

    expect(
      found.stdout
        .toString()
        .split('\n')
        .filter((line) => !line.endsWith('release-plan.test.ts') && line !== ''),
    ).toEqual([]);
  });
});
