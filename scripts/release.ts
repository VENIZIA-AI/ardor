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
 *   bun scripts/release.ts --version 0.3.0      # an explicit version, for every package below it; overrides --mode
 *   bun scripts/release.ts --issue 138          # the release commits say [#138]
 *   bun scripts/release.ts --yes                # skip the confirmation prompt
 *
 * Atlas computes the release table from the tags each run pushes, so a chain leaves nothing to refresh.
 *
 * Each package is also waited for until its TARBALL answers 200 (`release-wait.ts`), not only its
 * dist-tag: the packument is listed minutes before the tarball, and the next package's clean-install
 * gate installs the one before it.
 */

import { countChangedSinceRelease, withDependents } from './release-scope';
import {
  assertAbove,
  isReleaseVersion,
  packagesForVersion,
  readReleaseArgs,
  type TReleaseTarget,
} from './release-version';
import { waitForTarball } from './release-wait';

const WORKFLOW = 'package-release.yml';
const BRANCH = 'develop';

/**
 * Dependency order, not alphabetical. A package must publish after everything it depends on, or the
 * release's own registry-existence gate fails on a version that is not out yet.
 */
const RELEASE_ORDER = ['kernel', 'react', 'admin', 'ardor'] as const;

interface IPackageState {
  name: string;
  packageName: string;
  localVersion: string;
  publishedVersion: string | null;
  /** Every version on the registry before dispatch; a new one is the proof of a publish. */
  publishedVersions: string[];
  changedFiles: number;
  /** The `@venizia/*` workspace packages this one depends on, by package name. */
  internalDependencies: string[];
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
      internalDependencies: Object.keys(manifest.dependencies ?? {}).filter(dep =>
        dep.startsWith('@venizia/ardor'),
      ),
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
  target: TReleaseTarget;
  issue?: string;
  /** The npm names this run published earlier; the workflow's registry gate trusts their workspace version. */
  chainReleased: string[];
}): Promise<void> => {
  const { state, target } = opts;

  console.log(`\n▶ ${state.name} (${state.localVersion} -> ${target})`);

  const previousRunId = await resolveLatestRunId();

  // `--ref` is not optional: without it `gh` dispatches against the DEFAULT branch, and GitHub
  // validates the inputs against that branch's copy of the workflow. `main` still carries the
  // pre-ARDOR dropdown, so the dispatch comes back HTTP 422.
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
      // An explicit version rides its own input; the workflow lets it replace the bump type.
      isReleaseVersion({ value: target }) ? `version=${target}` : `build_mode=${target}`,
      // The previous package is published but npm may not show it yet: name it, so the next run's
      // registry gate checks its workspace version instead of waiting for the registry.
      ...(opts.chainReleased.length > 0
        ? ['-f', `chain_released=${opts.chainReleased.join(',')}`]
        : []),
      ...(opts.issue === undefined ? [] : ['-f', `issue=${opts.issue}`]),
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
  console.log(`  published ${state.packageName}@${published} - waiting for its tarball...`);

  // The next package installs this one. Its packument is listed before its tarball answers.
  await waitForTarball({ packageName: state.packageName, version: published });
  console.log('  tarball installable');

  // The workflow pushes its own release commit. Without this the next package reads a stale local
  // version and the operator reads a repo that disagrees with the registry.
  await run({ command: ['git', 'pull', '--ff-only', '--quiet', 'origin', BRANCH] });
};

const main = async (): Promise<void> => {
  const args = Bun.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirmed = args.includes('--yes');
  const { target, positional: requested, issue } = readReleaseArgs({ argv: args });
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
  // An explicit request is honoured as given; a full sweep releases what changed AND every package
  // depending on one of those. A prerelease falls outside a dependent's caret range (`^0.1.1` does
  // not admit `0.1.2-0`), so an unreleased dependent drags in a second copy of the old dependency.
  // An explicit version is shared by every package, so a sweep takes each package still below it,
  // changed or not; a named package must be below it too.
  let plan = requested.length > 0 ? states : withDependents({ states });

  if (isReleaseVersion({ value: target })) {
    plan = requested.length > 0 ? states : packagesForVersion({ states, version: target });

    for (const state of plan) {
      assertAbove({ version: target, current: state.localVersion });
    }
  }

  if (plan.length === 0) {
    console.log(
      'Nothing to release - no package has changed its code, manifest or build config since its last release.',
    );
    return;
  }

  console.log(`Release plan (${target}), in dependency order:\n`);
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

  const chainReleased: string[] = [];

  for (const state of plan) {
    await releasePackage({ state, target, issue, chainReleased });
    chainReleased.push(state.packageName);
  }

  console.log(`\n✓ Released ${plan.length} package(s).`);
};

await main();

export {};
