/**
 * Drives the NPM Release workflow one package at a time, in dependency order, waiting for each run
 * to finish before dispatching the next.
 *
 * The waiting is the whole point. `package-release.yml` runs `force-update` over the WHOLE workspace
 * (`--filter "@venizia/*"`), so a range that goes stale mid-flight fails the run. Dispatching by
 * hand invites exactly that.
 *
 *   bun scripts/release.ts                      # every package that needs one, in order
 *   bun scripts/release.ts kernel react         # just these, still ordered and still sequential
 *   bun scripts/release.ts --dry-run            # print the plan, dispatch nothing
 *   bun scripts/release.ts --mode patch         # default is prerelease
 *   bun scripts/release.ts --yes                # skip the confirmation prompt
 *   bun scripts/release.ts kernel --no-tables   # release without refreshing the atlas tables
 *
 * Every chain ends by regenerating the symbol and release tables atlas serves. They are generated
 * FROM release commits, so the chain that just shipped is exactly what makes them stale: skip the
 * refresh and `version` reports a consumer as current while it is ahead of the table, and `changes`
 * answers "unknown version" for what just shipped. `--no-tables` opts out for a one-package fix.
 *
 * ARDOR ships no atlas package - the MCP server is `@venizia/ignis-atlas` run against this checkout
 * - so this refresh is the whole of what used to be an "atlas tail" elsewhere in the family.
 */

import { countChangedSinceRelease } from './release-scope';

const WORKFLOW = 'package-release.yml';
const BRANCH = 'develop';

/** What `refreshGeneratedTables` regenerates and commits, relative to the repository root. */
const TABLE_PATHS = [
  '.agents/knowledge/reference/releases.json',
  '.agents/knowledge/reference/symbols.json',
];

/**
 * Dependency order, not alphabetical. A package must publish after everything it depends on, or the
 * release's own registry-existence gate fails on a version that is not out yet.
 *
 * `ui-kit` depends on nothing in the chain, but still runs sequentially, because the workspace-wide
 * `force-update` is what cannot overlap.
 */
const RELEASE_ORDER = ['kernel', 'react', 'admin', 'ardor', 'ui-kit'] as const;

type TReleaseMode =
  'patch' | 'minor' | 'major' | 'prepatch' | 'preminor' | 'premajor' | 'prerelease';

interface IPackageState {
  name: string;
  packageName: string;
  localVersion: string;
  publishedVersion: string | null;
  /** Every version on the registry before dispatch; a new one is the proof of a publish. */
  publishedVersions: string[];
  changedFiles: number;
}

const run = async (opts: {
  command: string[];
  allowFailure?: boolean;
}): Promise<{ stdout: string; exitCode: number }> => {
  const proc = Bun.spawn(opts.command, { stdout: 'pipe', stderr: 'pipe' });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0 && !opts.allowFailure) {
    throw new Error(`[${opts.command.join(' ')}] exited ${exitCode}\n${stderr || stdout}`);
  }

  return { stdout: stdout.trim(), exitCode };
};

const readJson = async (path: string): Promise<Record<string, string>> => {
  return JSON.parse(await Bun.file(path).text());
};

/** The published `next` version, or null when the package has never been released. */
const resolvePublishedVersion = async (opts: { packageName: string }): Promise<string | null> => {
  const { stdout, exitCode } = await run({
    command: ['npm', 'view', `${opts.packageName}@next`, 'version'],
    allowFailure: true,
  });

  return exitCode === 0 && stdout ? stdout : null;
};

/** Every published version, whatever its dist-tag. */
const listPublishedVersions = async (opts: { packageName: string }): Promise<string[]> => {
  const { stdout, exitCode } = await run({
    command: ['npm', 'view', opts.packageName, 'versions', '--json'],
    allowFailure: true,
  });
  if (exitCode !== 0 || !stdout) {
    return [];
  }

  const parsed = JSON.parse(stdout) as string | string[];
  return Array.isArray(parsed) ? parsed : [parsed];
};

const collectState = async (opts: { names: readonly string[] }): Promise<IPackageState[]> => {
  const states: IPackageState[] = [];

  for (const name of opts.names) {
    const manifestPath = `packages/${name}/package.json`;
    if (!(await Bun.file(manifestPath).exists())) {
      continue;
    }

    const manifest = await readJson(manifestPath);

    states.push({
      name,
      packageName: manifest.name,
      localVersion: manifest.version,
      publishedVersion: await resolvePublishedVersion({ packageName: manifest.name }),
      publishedVersions: await listPublishedVersions({ packageName: manifest.name }),
      changedFiles: countChangedSinceRelease({ name }),
    });
  }

  return states;
};

/**
 * Refuses to start from a tree that would publish something other than what the operator is looking
 * at. The workflow checks out the BRANCH, not the local HEAD, so anything uncommitted or unpushed is
 * simply not in the release.
 */
const assertReleasable = async (opts: { isDryRun: boolean }): Promise<void> => {
  // Reported rather than thrown on a dry run: it publishes nothing, and it is most useful WHILE the
  // tree is still dirty - refusing to plan a release until the work is committed is backwards.
  const complain = (message: string): void => {
    if (opts.isDryRun) {
      console.log(`  ! ${message}`);
      return;
    }
    throw new Error(message);
  };

  // Always fetched: every version this script reports is read from the local checkout, and a stale
  // checkout is what makes the repo and the registry look like they disagree when they do not.
  await run({ command: ['git', 'fetch', 'origin', '--quiet'] });

  const { stdout: branch } = await run({ command: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'] });
  if (branch !== BRANCH) {
    complain(`On '${branch}', not '${BRANCH}'. The workflow releases from '${BRANCH}'.`);
  }

  const { stdout: dirty } = await run({ command: ['git', 'status', '--porcelain'] });
  if (dirty) {
    complain(
      `Working tree is not clean - ${dirty.split('\n').length} path(s). The workflow builds from the remote, so uncommitted work would NOT be released.`,
    );
  }

  const { stdout: counts } = await run({
    command: ['git', 'rev-list', '--left-right', '--count', `HEAD...origin/${BRANCH}`],
  });
  const [ahead, behind] = counts.split(/\s+/).map(Number);

  if (ahead > 0) {
    complain(`${ahead} commit(s) not pushed. The workflow builds origin/${BRANCH}; push first.`);
  }
  if (behind > 0) {
    complain(
      `${behind} commit(s) behind origin/${BRANCH}. Pull first, or you will read stale versions.`,
    );
  }

  // npm ships `catalog:` and `workspace:` verbatim, so a package published with it installs as
  // `lodash@catalog: failed to resolve` on every consumer. `release-local.ts` asserts this about
  // its own source; nothing asserted it about the YAML this script dispatches, and four packages
  // shipped broken before anyone tried to install one.
  const workflowPath = '.github/workflows/package-release.yml';
  const workflow = await Bun.file(workflowPath).text();
  if (!/^\s*bun publish\b/m.test(workflow)) {
    complain(`${workflowPath} must publish with \`bun publish\` - npm ships catalog: verbatim.`);
  }
};

/** The most recent run id for this workflow, so a new dispatch can be told apart from it. */
const resolveLatestRunId = async (): Promise<string> => {
  const { stdout } = await run({
    command: [
      'gh',
      'run',
      'list',
      `--workflow=${WORKFLOW}`,
      '--limit',
      '1',
      '--json',
      'databaseId',
    ],
  });

  const runs = JSON.parse(stdout) as Array<{ databaseId: number }>;
  return runs[0] ? String(runs[0].databaseId) : '';
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Polls until a run newer than `previousRunId` appears, so we watch OUR dispatch and not an older one. */
const waitForNewRun = async (opts: { previousRunId: string }): Promise<string> => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(4_000);

    const latest = await resolveLatestRunId();
    if (latest && latest !== opts.previousRunId) {
      return latest;
    }
  }

  throw new Error('Dispatched, but no new workflow run appeared within two minutes.');
};

const waitForCompletion = async (opts: { runId: string }): Promise<string> => {
  for (;;) {
    const { stdout } = await run({
      command: ['gh', 'run', 'view', opts.runId, '--json', 'status,conclusion'],
    });

    const { status, conclusion } = JSON.parse(stdout) as { status: string; conclusion: string };
    if (status === 'completed') {
      return conclusion;
    }

    await sleep(10_000);
  }
};

/**
 * A green workflow is not proof of a publish. Verified against the registry, because the release
 * publishes BEFORE it commits: a run can put a version on npm and still fail afterwards, and the
 * reverse - a green run whose publish silently did nothing - is exactly what this catches.
 */
const assertPublished = async (opts: { state: IPackageState }): Promise<string> => {
  // A version absent before dispatch, not a dist-tag: a stable release goes to `latest` and leaves
  // `next` where it was. Four minutes, because the registry can lag the publish.
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const versions = await listPublishedVersions({ packageName: opts.state.packageName });
    const fresh = versions.find(version => !opts.state.publishedVersions.includes(version));

    if (fresh) {
      return fresh;
    }

    await sleep(5_000);
  }

  throw new Error(
    `${opts.state.packageName} shows no new version on the registry after four minutes. Check \`npm view ${opts.state.packageName} versions\` before assuming it failed - the registry may simply be lagging.`,
  );
};

const releasePackage = async (opts: {
  state: IPackageState;
  mode: TReleaseMode;
}): Promise<void> => {
  const { state, mode } = opts;

  console.log(`\n▶ ${state.name} (${state.localVersion} -> ${mode})`);

  const previousRunId = await resolveLatestRunId();

  // `--ref` is not optional: without it `gh` dispatches against the DEFAULT branch, and GitHub
  // validates the inputs against that branch's copy of the workflow. `main` still carries the
  // pre-ARDOR dropdown, so every package but `ui-kit` comes back HTTP 422.
  await run({
    command: [
      'gh',
      'workflow',
      'run',
      WORKFLOW,
      '--ref',
      BRANCH,
      '-f',
      `package=${state.name}`,
      '-f',
      `build_mode=${mode}`,
    ],
  });

  const runId = await waitForNewRun({ previousRunId });
  console.log(`  run ${runId} - waiting...`);

  const conclusion = await waitForCompletion({ runId });
  if (conclusion !== 'success') {
    throw new Error(
      `Run ${runId} finished '${conclusion}'. See: gh run view ${runId} --log-failed`,
    );
  }

  const published = await assertPublished({ state });
  console.log(`  published ${state.packageName}@${published}`);

  // The workflow pushes its own release commit. Without this the next package reads a stale local
  // version and the operator reads a repo that disagrees with the registry.
  await run({ command: ['git', 'pull', '--ff-only', '--quiet', 'origin', BRANCH] });
};

/**
 * Regenerates the tables atlas serves and commits them when they moved. Runs after the chain, never
 * as a member of it: the tables are generated FROM release commits, so they are always stale by
 * exactly the chain that just shipped.
 */
const refreshGeneratedTables = async (): Promise<void> => {
  console.log('\n▶ refreshing the tables atlas ships');
  await run({ command: ['make', 'releases-gen'] });
  await run({ command: ['make', 'symbols-gen'] });

  const { stdout: dirty } = await run({
    command: ['git', 'status', '--porcelain', '--', TABLE_PATHS[0], TABLE_PATHS[1]],
  });
  if (dirty.trim().length === 0) {
    console.log('  tables already current');
    return;
  }

  await run({ command: ['git', 'add', ...TABLE_PATHS] });
  await run({
    command: ['git', 'commit', '-m', 'chore(atlas): refresh the generated tables for the release'],
  });
  await run({ command: ['git', 'push', 'origin', BRANCH] });
  console.log('  tables committed and pushed');
};

const main = async (): Promise<void> => {
  const args = Bun.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirmed = args.includes('--yes');
  const skipTables = args.includes('--no-tables');
  const modeIndex = args.indexOf('--mode');
  const mode = (modeIndex >= 0 ? args[modeIndex + 1] : 'prerelease') as TReleaseMode;

  const requested = args.filter(arg => !arg.startsWith('--') && arg !== mode);
  const candidates =
    requested.length > 0 ? RELEASE_ORDER.filter(n => requested.includes(n)) : RELEASE_ORDER;

  const unknown = requested.filter(name => !RELEASE_ORDER.includes(name as never));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown package(s): ${unknown.join(', ')}. Known: ${RELEASE_ORDER.join(', ')}`,
    );
  }

  await assertReleasable({ isDryRun });

  const states = await collectState({ names: candidates });
  // An explicit request is honoured as given; a full sweep releases only what actually changed.
  const plan = requested.length > 0 ? states : states.filter(state => state.changedFiles > 0);

  if (plan.length === 0) {
    console.log(
      'Nothing to release - no package has changed its code, manifest or build config since its last release.',
    );
    return;
  }

  console.log(`Release plan (${mode}), in dependency order:\n`);
  for (const state of plan) {
    const changed =
      state.changedFiles === Number.POSITIVE_INFINITY
        ? 'never released'
        : `${state.changedFiles} file(s)`;
    console.log(
      `  ${state.name.padEnd(13)} ${state.localVersion.padEnd(10)} npm:${(state.publishedVersion ?? '-').padEnd(10)} ${changed}`,
    );
  }

  if (isDryRun) {
    console.log('\n--dry-run: nothing dispatched.');
    return;
  }

  if (!isConfirmed) {
    console.log(`\nThis publishes ${plan.length} package(s) to npm. Re-run with --yes to proceed.`);
    return;
  }

  for (const state of plan) {
    await releasePackage({ state, mode });
  }

  // After the loop, not inside it: every release commit in this chain has to exist before the
  // tables are generated from them. Hanging this off a tail entry is how it silently never ran.
  if (!skipTables) {
    await refreshGeneratedTables();
  }

  console.log(`\n✓ Released ${plan.length} package(s).`);
};

await main();

export {};
