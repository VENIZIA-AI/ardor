import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..', '..', '..');
const PATH = join(ROOT, '.github/workflows/deploy-docs.yml');

/** The text of each job of a workflow, by job id. */
const jobsOf = (opts: { workflow: string }): Record<string, string> => {
  const section = opts.workflow.split(/\njobs:\n/)[1] ?? '';
  const starts = [...section.matchAll(/^ {2}([\w-]+):\s*$/gm)];

  return Object.fromEntries(
    starts.map((start, index) => [
      start[1] ?? '',
      section.slice(start.index, starts[index + 1]?.index ?? section.length),
    ]),
  );
};

// The Docs workflow deploys the wiki to Pages and, as a job of its own, signs the atlas index with a secret and
// uploads it to a release, so it is read as text and held to the rules that each of the two old workflows had:
// the triggers they had, write access only on the jobs that need it, the key only on the step that publishes.
describe('deploy-docs.yml (the Docs workflow)', () => {
  const workflow = existsSync(PATH) ? readFileSync(PATH, 'utf8') : '';
  const head = workflow.split(/\njobs:\n/)[0] ?? '';
  const jobs = jobsOf({ workflow });

  test('the workflow exists, is named Docs and is titled by its branch', () => {
    expect(workflow.length).toBeGreaterThan(0);
    expect(head).toMatch(/^name: Docs\n/);
    expect(head).toMatch(/\nrun-name: 'Docs · \$\{\{ github\.ref_name \}\}'\n/);
  });

  test('the jobs are the docs ones and the atlas index; the atlas index file is gone', () => {
    expect(Object.keys(jobs)).toEqual(['changes', 'build', 'deploy', 'atlas-index']);
    expect(existsSync(join(ROOT, '.github/workflows/atlas-index.yml'))).toBe(false);
  });

  test('it runs on a push to main or develop, of a tag, or by hand, and on nothing else', () => {
    expect(head).toMatch(
      /\non:\n {2}push:\n {4}branches:\n {6}- main\n {6}- develop\n {4}tags:\n {6}- '\*'\n {2}workflow_dispatch:\n/,
    );
    expect(workflow).not.toContain('pull_request');
    expect(workflow).not.toContain('schedule:');
    // A path filter on the trigger would stop the atlas job on a push that does not touch the wiki.
    expect(head).not.toContain('paths:');
  });

  test('the wiki is built for a manual run and for a push to develop that touches docs/wiki, and for no other event', () => {
    const changes = jobs['changes'] ?? '';

    expect(changes).toContain('if [ "$EVENT" = "workflow_dispatch" ]; then\n            docs=true');
    expect(changes).toContain('[ "$REF" = "refs/heads/develop" ]');
    expect(changes).toContain('git diff --quiet "$BEFORE" "$GITHUB_SHA" -- docs/wiki');
    expect(changes).toContain('fetch-depth: 0');
    expect(jobs['build']).toMatch(
      /needs: changes\n {4}if: needs\.changes\.outputs\.docs == 'true'\n/,
    );
    expect(jobs['deploy']).toContain('needs: build');
    expect(jobs['deploy']).toContain('name: github-pages');
  });

  test('the atlas index runs on a push only, as it did', () => {
    expect(jobs['atlas-index']).toMatch(/\n {4}if: github\.event_name == 'push'\n/);
    expect(jobs['atlas-index']).toMatch(/group: atlas-index-\$\{\{ github\.ref \}\}\n/);
    expect(jobs['atlas-index']).toMatch(/cancel-in-progress: false/);
  });

  test('read-only by default; Pages access only on the build and deploy jobs; the one job that uploads can write', () => {
    expect(head).toMatch(/\npermissions:\n {2}contents: read\n/);
    expect(head).not.toContain('pages: write');
    expect(head).not.toContain('id-token');

    for (const id of ['build', 'deploy']) {
      expect(jobs[id]).toMatch(
        /\n {4}permissions:\n {6}contents: read\n {6}pages: write\n {6}id-token: write\n/,
      );
    }

    expect(jobs['changes']).not.toContain('permissions:');
    expect(jobs['atlas-index']).toMatch(
      /\n {4}permissions:\n {6}contents: write\n {4}concurrency:/,
    );
    expect([...workflow.matchAll(/contents: write/g)]).toHaveLength(1);
    expect([...workflow.matchAll(/pages: write/g)]).toHaveLength(2);
    expect([...workflow.matchAll(/id-token: write/g)]).toHaveLength(2);
  });

  test('the Pages deployments queue in one group', () => {
    expect(jobs['deploy']).toMatch(
      /concurrency:\n {6}group: pages\n {6}cancel-in-progress: false\n/,
    );
  });

  test('the key is read only by the step that publishes', () => {
    const steps = (jobs['atlas-index'] ?? '').split(/\n {6}- /).slice(1);
    const withKey = steps.filter((step) => step.includes('secrets.'));

    expect(withKey).toHaveLength(1);
    expect(withKey[0]).toContain('uses: VENIZIA-AI/vulcan/.github/actions/atlas-index@');
    expect(withKey[0]).toContain('ATLAS_INDEX_KEY: ${{ secrets.ATLAS_INDEX_KEY }}');
    expect(
      [...workflow.matchAll(/secrets\.(\w+)/g)].every((match) => match[1] === 'ATLAS_INDEX_KEY'),
    ).toBe(true);
  });

  test('the actions of the atlas job are pinned by their full commit, VULCAN at the commit of the installed release', () => {
    const uses = [...(jobs['atlas-index'] ?? '').matchAll(/^\s+uses: (.+)$/gm)].map(
      (match) => match[1] ?? '',
    );
    const vulcanVersion: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
      .devDependencies['@venizia/vulcan'];

    expect(uses.length).toBeGreaterThanOrEqual(3);
    expect(
      uses.every((value) => /^[\w.-]+\/[\w.\/-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/.test(value)),
    ).toBe(true);
    expect(uses.find((value) => value.startsWith('VENIZIA-AI/vulcan/'))).toContain(
      `# v${vulcanVersion}`,
    );
  });

  test('the atlas checkout has the whole history and its bun is exact', () => {
    expect(jobs['atlas-index']).toMatch(/fetch-depth: 0/);
    expect(jobs['atlas-index']).toMatch(/bun-version: \d+\.\d+\.\d+\n/);
  });
});
