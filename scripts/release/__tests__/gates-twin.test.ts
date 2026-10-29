import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..', '..', '..');
const PACKAGES = ['kernel', 'react', 'admin', 'ardor'];
const LOOP = 'for package in ${PACKAGES//,/ }; do';

/** The text of the `test` job: from `  test:` under `jobs:` to the next job. */
const testJobOf = (workflow: string): string => {
  const section = workflow.split(/\njobs:\n/)[1] ?? '';
  const starts = [...section.matchAll(/^  ([\w-]+):\s*$/gm)];
  const index = starts.findIndex((start) => start[1] === 'test');
  const from = starts[index]?.index ?? 0;

  return section.slice(from, starts[index + 1]?.index ?? section.length);
};

/** The `run:` blocks of a job, in step order, without comment lines. */
const runsOf = (job: string): string[] =>
  job
    .split(/\n {6}- name: /)
    .slice(1)
    .map((chunk) => chunk.split(/\n {8}run: /)[1] ?? '')
    .filter((run) => run !== '')
    .map((run) =>
      run
        .split('\n')
        .filter((line) => !line.trim().startsWith('#'))
        .join('\n'),
    );

/** The make targets one `run:` block names, with the package loop expanded; the links gate is `links-check`. */
const targetsOf = (run: string): string[] => {
  const targets: string[] = [];
  const looped = run.includes(LOOP);

  if (run.includes('release-gates.ts links')) {
    return ['links-check'];
  }

  for (const line of run.split('\n')) {
    const found = line.match(/\bmake "?([\w$-]+)"?\s*$/);
    if (found?.[1] === undefined) {
      continue;
    }

    const template = found[1];
    targets.push(
      ...(looped ? PACKAGES.map((name) => template.replace('$package', name)) : [template]),
    );
  }

  return targets;
};

/** The first line `make -n gates` prints is the chain of sub-makes: one `make --no-print-directory <target>` each. */
const gateTargets = (): string[] => {
  const proc = Bun.spawnSync(['make', '-n', 'gates'], { cwd: ROOT });
  const first = proc.stdout.toString().split('\n')[0] ?? '';

  return first
    .split(' && ')
    .map((part) => part.match(/^make --no-print-directory ([\w-]+)$/)?.[1])
    .filter((target): target is string => target !== undefined);
};

describe('make gates is the local twin of the Test job of package-release.yml (S4.7)', () => {
  const workflow = readFileSync(resolve(ROOT, '.github/workflows/package-release.yml'), 'utf8');
  const fromWorkflow = runsOf(testJobOf(workflow)).flatMap(targetsOf);

  test('it runs the same make targets, in the same order', () => {
    expect(gateTargets()).toEqual(fromWorkflow);
  });

  test('the Test job names every gate it runs (a guard against an empty comparison)', () => {
    expect(fromWorkflow).toEqual([
      'links-check',
      ...PACKAGES,
      ...PACKAGES.map((name) => `lint-${name}`),
      ...PACKAGES.map((name) => `test-${name}`),
      'test-scripts',
      'purity-test',
      ...PACKAGES.map((name) => `purity-${name}`),
      'catalog-check',
      'preset-smoke',
    ]);
  });
});
