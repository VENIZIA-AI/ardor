/**
 * Dispatches the Release workflow once and checks what it did.
 *
 * One dispatch is one run for every package it names: the workflow releases them in dependency order at
 * one version (`release-chain.ts`), so there is nothing to wait for between packages here. This script
 * plans the run (the packages, the one version, the kind), sends exactly one `gh workflow run`, waits for the
 * run to finish, reads the registry for every package of the plan and brings `develop` up to date.
 *
 * The kind of the version picks the branch (`ReleasePlan.branchOf`): a prerelease (`prerelease`, `prepatch`,
 * `preminor`, `premajor`, or a version with a prerelease part) runs from `develop`, a stable (`patch`, `minor`,
 * `major`, or a version without one) from `main`. Versions and workflow files are read from `origin/<branch>`,
 * so a stable needs no local checkout of `main`. A stable waits for one approval on the `release-approval`
 * environment, given in the run on GitHub; after it the workflow merges `main` back into `develop` and this
 * script fast-forwards the local `develop`.
 *
 *   bun scripts/release/release.ts                      # the four packages, as a prerelease
 *   bun scripts/release/release.ts --dry-run            # print the dispatch, send nothing
 *   bun scripts/release/release.ts --mode patch         # a stable, from main; default is prerelease
 *   bun scripts/release/release.ts --version 0.4.7      # an explicit version; overrides --mode
 *   bun scripts/release/release.ts kernel react --version 0.4.7   # resume: only these, still ordered
 *   bun scripts/release/release.ts --issue 138          # the release commits say [#138]
 *   bun scripts/release/release.ts --yes                # skip the confirmation prompt
 *
 * A mode needs the four packages at one current version, because the same mode over different versions
 * gives different results; the plan resolves it to an explicit version before it dispatches. Naming
 * packages is the way to resume a run that stopped half way: it needs `--version`, plans the packages
 * below it and leaves the ones already at it.
 *
 * Atlas computes the release table from the tags each run pushes, so a run leaves nothing to refresh.
 */

import { isTrustedPublishWorkflow } from './release-gates';
import { type IPlannedPackage, ReleaseKinds, ReleasePlan, type TReleaseKind } from './release-plan';
import { isReleaseVersion, readReleaseArgs } from './release-version';
import { ReleaseVerify } from './release-verify';
import { waitForCompletion } from './release-wait';

interface IPackageState extends IPlannedPackage {
  packageName: string;
  publishedVersion: string | null;
  /** Every version on the registry before dispatch; a new one is the proof of a publish. */
  publishedVersions: string[];
}

const WORKFLOW_PATH = `.github/workflows/${ReleasePlan.WORKFLOW}`;
const CHAIN_PATH = 'scripts/release/release-chain.ts';

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

/** A file as the branch holds it on the remote: what the workflow builds, whatever is checked out here. Empty when the branch has none. */
const readFromRemote = async (opts: { branch: string; path: string }): Promise<string> => {
  const { stdout, exitCode } = await run({
    command: ['git', 'show', `origin/${opts.branch}:${opts.path}`],
    allowFailure: true,
  });

  return exitCode === 0 ? stdout : '';
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

const collectState = async (opts: {
  names: readonly string[];
  branch: string;
}): Promise<IPackageState[]> => {
  const states: IPackageState[] = [];

  for (const name of opts.names) {
    const manifestPath = `packages/${name}/package.json`;
    const shown = await run({
      command: ['git', 'show', `origin/${opts.branch}:${manifestPath}`],
      allowFailure: true,
    });
    if (shown.exitCode !== 0) {
      continue;
    }

    const manifest = JSON.parse(shown.stdout) as Record<string, string>;

    states.push({
      name,
      packageName: manifest.name,
      localVersion: manifest.version,
      publishedVersion: await resolvePublishedVersion({ packageName: manifest.name }),
      publishedVersions: await listPublishedVersions({ packageName: manifest.name }),
    });
  }

  return states;
};

/**
 * Refuses to start from a tree that would publish something other than what the operator is looking
 * at. The workflow checks out the branch, not the local HEAD, so anything uncommitted or unpushed is
 * simply not in the release. A stable reads only `origin/main`, so it has no local tree to check.
 */
const assertReleasable = async (opts: { isDryRun: boolean; branch: string }): Promise<void> => {
  const { branch: target } = opts;
  const isStable = target === ReleasePlan.STABLE_REF;

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

  if (!isStable) {
    const { stdout: branch } = await run({ command: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'] });
    if (branch !== target) {
      complain(`On '${branch}', not '${target}'. The workflow releases from '${target}'.`);
    }

    const { stdout: dirty } = await run({ command: ['git', 'status', '--porcelain'] });
    if (dirty) {
      complain(
        `Working tree is not clean - ${dirty.split('\n').length} path(s). The workflow builds from the remote, so uncommitted work would NOT be released.`,
      );
    }

    const { stdout: counts } = await run({
      command: ['git', 'rev-list', '--left-right', '--count', `HEAD...origin/${target}`],
    });
    const [ahead, behind] = counts.split(/\s+/).map(Number);

    if (ahead > 0) {
      complain(`${ahead} commit(s) not pushed. The workflow builds origin/${target}; push first.`);
    }
    if (behind > 0) {
      complain(
        `${behind} commit(s) behind origin/${target}. Pull first, or you will read stale versions.`,
      );
    }
  }

  // npm ships `catalog:` and `workspace:` verbatim, so a package published from npm's own pack installs as
  // `lodash@catalog: failed to resolve` on every consumer. The check below asserts it about the files
  // this script dispatches: four packages shipped broken before anyone tried to install one. Only
  // `bun pm pack` resolves them, and npm then publishes that tarball with a provenance. The workflow
  // calls the chain and the chain holds the pack and the publish, so both are read.
  const workflow = await readFromRemote({ branch: target, path: WORKFLOW_PATH });
  const chain = await readFromRemote({ branch: target, path: CHAIN_PATH });
  if (!isTrustedPublishWorkflow({ workflow, chain })) {
    complain(
      `origin/${target} must hold a ${WORKFLOW_PATH} that runs ${CHAIN_PATH}, which must publish a tarball packed by \`bun pm pack\` with \`npm publish --provenance\` - npm ships catalog: verbatim.`,
    );
  }
};

/** The most recent run id for this workflow, so a new dispatch can be told apart from it. */
const resolveLatestRunId = async (): Promise<string> => {
  const { stdout } = await run({
    command: [
      'gh',
      'run',
      'list',
      `--workflow=${ReleasePlan.WORKFLOW}`,
      '--limit',
      '1',
      '--json',
      'databaseId',
    ],
  });

  const runs = JSON.parse(stdout) as Array<{ databaseId: number }>;
  return runs[0] ? String(runs[0].databaseId) : '';
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

const waitForRunCompletion = (opts: { runId: string }): Promise<string> =>
  waitForCompletion({
    runId: opts.runId,
    readRun: async ({ runId }) => {
      const { stdout } = await run({
        command: ['gh', 'run', 'view', runId, '--json', 'status,conclusion'],
      });

      return JSON.parse(stdout) as { status: string; conclusion: string };
    },
    // A run can wait in the queue behind another release (one at a time, repository-wide); keep waiting.
    onWaiting: ({ runId }) => {
      console.log(`  run ${runId} is waiting to start - still waiting`);
    },
  });

/** Brings the local `develop` to the remote's: the merge back of a stable put commits there. */
const fastForwardDevelop = async (): Promise<void> => {
  const { stdout: current } = await run({ command: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'] });
  const develop = ReleasePlan.REF;

  await run({
    command:
      current === develop
        ? ['git', 'pull', '--ff-only', '--quiet', 'origin', develop]
        : ['git', 'fetch', '--quiet', 'origin', `${develop}:${develop}`],
  });
};

/** The one dispatch of the run, then the run's end and the registry. */
const releaseRun = async (opts: {
  dispatch: ReturnType<typeof ReleasePlan.dispatch>;
  states: IPackageState[];
  kind: TReleaseKind;
}): Promise<void> => {
  const previousRunId = await resolveLatestRunId();

  // `--ref` is not optional: without it `gh` dispatches against the DEFAULT branch, and GitHub
  // validates the inputs against that branch's copy of the workflow. `ReleasePlan.dispatchArgs` carries it.
  await run({ command: ReleasePlan.dispatchArgs({ dispatch: opts.dispatch }) });

  const runId = await waitForNewRun({ previousRunId });
  console.log(`  run ${runId} - waiting...`);
  if (opts.kind === ReleaseKinds.STABLE) {
    console.log(
      `  one approval is waiting on release-approval: approve the deployment in the run on GitHub (gh run view ${runId} --web)`,
    );
  }

  const conclusion = await waitForRunCompletion({ runId });
  if (conclusion !== 'success') {
    throw new Error(
      `Run ${runId} finished '${conclusion}'. See: gh run view ${runId} --log-failed`,
    );
  }

  // The chain waited for each tarball to answer 200 before it moved on. What is left to check here is that
  // the registry holds every version the run claims, and that `develop` has the commits it pushed.
  const published = await ReleaseVerify.verifyRun({
    states: opts.states,
    listVersions: listPublishedVersions,
    pull: fastForwardDevelop,
  });

  for (const [packageName, version] of Object.entries(published)) {
    console.log(`  published ${packageName}@${version}`);
  }
};

const main = async (): Promise<void> => {
  const args = Bun.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirmed = args.includes('--yes');
  const { target, positional: requested, issue } = readReleaseArgs({ argv: args });

  if (requested.length > 0 && !isReleaseVersion({ value: target })) {
    throw new Error(
      `Naming packages (${requested.join(', ')}) resumes a run and needs --version <x.y.z>: a mode releases all of ${ReleasePlan.ORDER.join(', ')}.`,
    );
  }

  // Named packages are put in dependency order; a name that is not a package still fails in validate.
  const order: readonly string[] = ReleasePlan.ORDER;
  const named =
    requested.length > 0
      ? [...requested].sort((a, b) => order.indexOf(a) - order.indexOf(b))
      : [...ReleasePlan.ORDER];
  ReleasePlan.validate({ packages: named });

  const kind = ReleasePlan.kindOfTarget({ target });
  const branch = ReleasePlan.branchOf({ kind });

  await assertReleasable({ isDryRun, branch });

  const states = await collectState({ names: named, branch });
  const { plan: resolved, problems } = ReleasePlan.plan({
    target,
    packages: states,
    ref: `refs/heads/${branch}`,
    issue,
  });

  if (resolved === undefined || problems.length > 0) {
    throw new Error(`The run may not be dispatched:\n  - ${problems.join('\n  - ')}`);
  }

  const plan = states.filter((state) => resolved.packages.includes(state.name));
  const isStable = kind === ReleaseKinds.STABLE;

  // A stable whose packages are all out can still owe the merge back: a run that stopped after the last
  // tag. The same version dispatched again runs only that, so it is not "nothing to release".
  const mergeBackOwed =
    isStable &&
    plan.length === 0 &&
    (await run({
      command: ['git', 'merge-base', '--is-ancestor', 'origin/main', 'origin/develop'],
      allowFailure: true,
    }).then((result) => result.exitCode !== 0));

  if (plan.length === 0 && !mergeBackOwed) {
    console.log(`Nothing to release - every package is already at ${resolved.version}.`);
    return;
  }

  console.log(
    `Release plan (${target} -> ${resolved.version}, a ${kind} from ${branch}), in dependency order:\n`,
  );
  for (const state of states) {
    const note = resolved.skipped.includes(state.name) ? 'already there, left alone' : 'to release';
    console.log(
      `  ${state.name.padEnd(13)} ${state.localVersion.padEnd(10)} npm:${(state.publishedVersion ?? '-').padEnd(10)} ${note}`,
    );
  }

  if (mergeBackOwed) {
    console.log(
      `\nEvery package is at ${resolved.version}, but main is not in develop: the dispatch runs only the merge back.`,
    );
  }

  const packages = mergeBackOwed ? named : resolved.packages;
  // The run title: the workflow cannot work it out when it names the run, so it is sent, and the plan job
  // refuses one that is not its own. Only a workflow that declares the input can be sent one.
  const label = ReleasePlan.declaresLabel({
    workflow: await readFromRemote({ branch, path: WORKFLOW_PATH }),
  })
    ? ReleasePlan.labelOf({
        version: resolved.version,
        kind,
        packages,
        issue,
        sha: (await run({ command: ['git', 'rev-parse', `origin/${branch}`], allowFailure: true }))
          .stdout,
      })
    : undefined;
  const dispatch = ReleasePlan.dispatch({
    plan: packages,
    version: resolved.version,
    issue,
    label,
    ref: branch,
  });
  console.log(`\n${ReleasePlan.describe({ dispatch })}`);
  if (label !== undefined) {
    console.log(`The run is titled: Release · ${label}`);
  }
  if (isStable) {
    console.log('A stable waits for one approval on release-approval, given in the run on GitHub.');
  }

  if (isDryRun) {
    console.log('\n--dry-run: nothing dispatched.');
    return;
  }

  if (!isConfirmed) {
    console.log(
      `\nThis publishes ${plan.length} package(s) to npm${isStable ? ' after one approval' : ''}. Re-run with --yes to proceed.`,
    );
    return;
  }

  await releaseRun({ dispatch, states: plan, kind });

  console.log(`\n✓ Released ${plan.length} package(s).`);
};

// Only a run of the file releases: an import (a test) reaches the helpers without side effects.
if (import.meta.main) {
  await main();
}

export {};
