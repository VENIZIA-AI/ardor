/**
 * Publishes from this machine instead of dispatching `package-release.yml`, running the same gates
 * in the same order. Faster because the workspace install happens once for a whole chain rather
 * than once per package, and it consumes no GitHub Actions minutes.
 *
 *   bun scripts/release-local.ts                      # every package, in dependency order
 *   bun scripts/release-local.ts kernel react         # just these, still ordered, still sequential
 *   bun scripts/release-local.ts --dry-run            # run every gate, publish and write nothing
 *   bun scripts/release-local.ts --mode patch         # default is prerelease
 *   bun scripts/release-local.ts --version 0.3.0      # an explicit version; overrides --mode
 *   bun scripts/release-local.ts --issue 138          # the release commit says [#138]
 *   bun scripts/release-local.ts --yes                # skip the confirmation prompt
 *
 * CI checks out a clean tree from the pushed ref; this does not, so it is deliberately STRICTER: it
 * refuses a dirty tree and refuses when HEAD is not what `origin/develop` points at. Without those,
 * this can publish a tarball containing code that is in no commit - unreviewable, unreproducible,
 * and silent.
 *
 * Everything the workflow's comments call out as paid for is preserved here, in particular:
 * `force-update` runs before the install and across the whole workspace; the publish is the FIRST
 * mutation, ahead of every git write, so a rejected publish leaves nothing to roll back; and the
 * publisher is `bun`, never `npm`, because only bun resolves `catalog:`/`workspace:` while packing.
 */

import { $ } from 'bun';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  exportTargets,
  fetchPackument,
  missingExportTargets,
  missingFromRegistry,
  readWorkspaceVersions,
  unresolvedProtocols,
  workspaceStrays,
} from './release-gates';
import { assertAbove, isReleaseVersion, npmTagFor, readReleaseArgs } from './release-version';

const BRANCH = 'develop';

/** Dependency order, mirrored from `scripts/release.ts` - a package publishes after everything it depends on. */
const RELEASE_ORDER = ['kernel', 'react', 'admin', 'ardor'] as const;

type TPackageName = (typeof RELEASE_ORDER)[number];

type TReleaseTarget = string;

interface IOptions {
  packages: TPackageName[];
  target: TReleaseTarget;
  issue?: string;
  dryRun: boolean;
  skipPrompt: boolean;
}

/** Mirrors the workflow's `case $PACKAGE in docs-mcp) ... esac`. */
const resolvePackagePath = (name: string): string => `packages/${name}`;

const fail = (message: string): never => {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
};

const readManifest = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));

// ---------------------------------------------------------------------------
// PREFLIGHT - the three checks CI gets for free from a clean checkout
// ---------------------------------------------------------------------------

const assertCleanTree = async (): Promise<void> => {
  const status = (await $`git status --porcelain`.text()).trim();

  if (status.length > 0) {
    fail(
      `Working tree is not clean. Publishing now would ship code that is in no commit.\n${status}`,
    );
  }
};

const assertPushed = async (): Promise<void> => {
  await $`git fetch --quiet origin ${BRANCH}`;

  const local = (await $`git rev-parse HEAD`.text()).trim();
  const remote = (await $`git rev-parse origin/${BRANCH}`.text()).trim();

  if (local !== remote) {
    fail(
      `HEAD is not ${BRANCH} on the remote - push first.\n` +
        `    local:  ${local.slice(0, 12)}\n    remote: ${remote.slice(0, 12)}`,
    );
  }
};

/**
 * `NPM_CONFIG_TOKEN`, never `NODE_AUTH_TOKEN`: bun reads neither `NODE_AUTH_TOKEN` nor
 * `BUN_AUTH_TOKEN`, and ignores the `.npmrc` path `actions/setup-node` writes - measured in CI.
 */
const assertNpmToken = (): void => {
  if (!process.env.NPM_CONFIG_TOKEN) {
    fail(
      'NPM_CONFIG_TOKEN is not set. Export it before publishing:\n' +
        '    export NPM_CONFIG_TOKEN=<token>',
    );
  }
};

/**
 * The `npm` binary sits in PATH on a developer machine, which CI's controlled image made unlikely.
 * npm ships `catalog:`/`workspace:` verbatim and breaks every consumer, so this asserts the script
 * has not drifted onto it. `release.ts` makes the same assertion about the workflow YAML.
 */
const assertPublisherIsBun = (): void => {
  const source = readFileSync('scripts/release-local.ts', 'utf8');

  if (!source.includes('bun publish')) {
    fail('The publish step must use `bun publish` - npm ships catalog: verbatim');
  }
};

// ---------------------------------------------------------------------------
// PER-PACKAGE GATES - the workflow's own, in its order
// ---------------------------------------------------------------------------

/** Every file the `exports` map names must exist. Derived from the manifest, never a hand-written list. */
const assertBuildArtifacts = (opts: { path: string; name: string }): void => {
  const exportsMap = readManifest(opts.path).exports;

  try {
    const targets = exportTargets({ exportsMap });
    const missing = missingExportTargets({ directory: opts.path, exportsMap });

    if (missing.length > 0) {
      fail(
        `[${opts.name}] \`exports\` names files the build did not emit:\n    ${missing.join('\n    ')}`,
      );
    }

    console.log(`      ✓ all ${targets.size} published entries exist`);
  } catch (error) {
    fail(`[${opts.name}] ${error instanceof Error ? error.message : String(error)}`);
  }
};

/** Every ARDOR sibling must resolve to this workspace, not to a registry tarball. */
const assertWorkspaceLinks = (opts: { path: string; name: string }): void => {
  const strays = workspaceStrays({ root: process.cwd(), directory: opts.path });

  if (strays.length > 0) {
    fail(
      `[${opts.name}] internal dependencies resolved to the registry:\n    ${strays.join('\n    ')}`,
    );
  }

  console.log('      ✓ every ARDOR sibling links to the workspace');
};

/**
 * Packs once and reads the manifest npm will receive, not the one in the working tree. An
 * unresolved protocol here means every consumer's install breaks.
 */
const readPackedManifest = async (opts: { path: string }): Promise<Record<string, unknown>> => {
  // The tarball name comes from `bun pm pack`'s own stdout, never a glob: Bun's `$` does not expand
  // `*`, so `ls ./*.tgz` returns empty and the extract then fails on an empty filename.
  const tarball = (await $`bun pm pack --quiet`.cwd(opts.path).text()).trim().split('\n').pop();

  if (!tarball?.endsWith('.tgz')) {
    fail(`[${opts.path}] \`bun pm pack\` did not name a tarball - got: ${tarball ?? '<empty>'}`);
  }

  try {
    const raw = await $`tar -xzOf ${tarball} package/package.json`.cwd(opts.path).text();
    return JSON.parse(raw);
  } finally {
    await $`rm -f ${tarball}`.cwd(opts.path).quiet().nothrow();
  }
};

const assertPackedManifest = (opts: { manifest: Record<string, unknown>; name: string }): void => {
  const found = unresolvedProtocols({ manifest: opts.manifest });

  if (found.length > 0) {
    fail(
      `[${opts.name}] unresolved workspace protocol survives into the published manifest: ${found.join(', ')}`,
    );
  }

  console.log('      ✓ the packed manifest resolves every protocol');
};

/**
 * A `workspace:*` on a never-published package resolves to a literal version while packing, so the
 * tarball names a package the registry has never heard of. Only the registry can answer this; a
 * package this run published a moment ago is checked against its workspace version instead.
 */
const assertDependenciesExist = async (opts: {
  manifest: Record<string, unknown>;
  name: string;
  chainReleased: string[];
}): Promise<void> => {
  const dependencies = Object.fromEntries(
    Object.entries((opts.manifest.dependencies ?? {}) as Record<string, string>),
  );
  const missing = await missingFromRegistry({
    dependencies,
    chainReleased: opts.chainReleased,
    workspaceVersions: readWorkspaceVersions({ root: process.cwd() }),
    fetchPackument,
  });

  if (missing.length > 0) {
    fail(
      `[${opts.name}] the packed manifest depends on something the registry cannot serve:\n    ${missing.join('\n    ')}`,
    );
  }

  console.log(
    `      ✓ all ${Object.keys(dependencies).length} runtime dependencies resolve on the registry`,
  );
};

// ---------------------------------------------------------------------------
// RELEASE ONE PACKAGE
// ---------------------------------------------------------------------------

const releasePackage = async (opts: {
  name: TPackageName;
  target: TReleaseTarget;
  issue?: string;
  chainReleased: string[];
  dryRun: boolean;
}): Promise<void> => {
  const { name, target, dryRun } = opts;
  const path = resolvePackagePath(name);
  const manifest = readManifest(path);
  const packageName = manifest.name as string;

  console.log(`\n  ── ${packageName} (${manifest.version} → ${target})`);

  if (isReleaseVersion({ value: target })) {
    assertAbove({ version: target, current: manifest.version as string });
  }

  assertWorkspaceLinks({ path, name });

  await $`make ${name}`.quiet();
  console.log('      ✓ build');

  await $`make ${`lint-${name}`}`.quiet();
  console.log('      ✓ lint');

  // The gate's own regression tests first: a probe that stopped detecting anything would leave
  // every `purity-*` target green for the wrong reason.
  await $`make purity-test`.quiet();
  await $`make ${`purity-${name}`}`.quiet().nothrow();
  console.log('      ✓ purity');

  assertBuildArtifacts({ path, name });
  await $`make catalog-check`.quiet();

  const packed = await readPackedManifest({ path });
  assertPackedManifest({ manifest: packed, name });
  await assertDependenciesExist({ manifest: packed, name, chainReleased: opts.chainReleased });

  // Only the umbrella carries a VULCAN preset: an app made from the packed one must be green first.
  if (name === 'ardor') {
    await $`make preset-smoke`.quiet();
    console.log('      ✓ preset smoke');
  }

  if (dryRun) {
    console.log('      ⊘ dry run - stopping before the version bump');
    return;
  }

  await $`npm version ${target} --no-git-tag-version --workspaces-update=false`.cwd(path).quiet();
  const nextVersion = readManifest(path).version as string;
  console.log(`      ✓ version ${nextVersion}`);

  // After the bump, so the preset names the version it ships in.
  if (name === 'ardor') {
    await $`bun scripts/vulcan-preset.ts`.quiet();
    console.log('      ✓ preset written');
  }

  const npmTag = npmTagFor({ target });

  // FIRST among the mutations, ahead of every git write. The publish is the only step that cannot
  // be undone, so a rejected one must leave git untouched - there is then nothing to roll back.
  // `--ignore-scripts` skips the already-run prepublishOnly.
  await $`bun publish --access public --tag ${npmTag} --ignore-scripts`.cwd(path);
  console.log(`      ✓ published ${packageName}@${nextVersion} (${npmTag})`);

  // Non-fatal: a tagging hiccup must never look like a failed release.
  await $`npm dist-tag add ${`${packageName}@${nextVersion}`} highest`.quiet().nothrow();

  // `next` is never below `latest`, for every ARDOR package. Non-fatal and loud.
  console.log((await $`bun scripts/release-gates.ts heal-next`.nothrow().text()).trimEnd());

  await $`git add ${join(path, 'package.json')}`;
  const subject = `chore(${name}): release v${nextVersion} [${target}]`;

  await $`git commit -m ${opts.issue === undefined ? subject : `[#${opts.issue}] ${subject}`}`.quiet();

  // `develop` can move between the preflight and here - a teammate's merge, or nothing at all. The
  // version is already on the registry by now, so rebase and retry once rather than leave the
  // branch behind a release that really happened.
  const pushed = await $`git push origin ${BRANCH}`.quiet().nothrow();
  if (pushed.exitCode !== 0) {
    await $`git pull --rebase origin ${BRANCH}`.quiet();
    await $`git push origin ${BRANCH}`;
  }

  const tag = `${name}-v${nextVersion}`;
  await $`git tag -a ${tag} -m ${`${packageName} v${nextVersion}`}`;
  await $`git push origin ${tag}`.quiet();

  console.log(`      ✓ committed, pushed, tagged ${tag}`);
};

// ---------------------------------------------------------------------------
// ENTRY
// ---------------------------------------------------------------------------

const parseOptions = (): IOptions => {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const skipPrompt = argv.includes('--yes');

  let target: TReleaseTarget;
  let named: TPackageName[];
  let issue: string | undefined;

  try {
    const read = readReleaseArgs({ argv });

    target = read.target;
    named = read.positional as TPackageName[];
    issue = read.issue;
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  for (const name of named) {
    if (!RELEASE_ORDER.includes(name)) {
      fail(`Unknown package '${name}'. Expected one of: ${RELEASE_ORDER.join(', ')}`);
    }
  }

  // Always dependency order, never the order they were typed.
  const packages =
    named.length > 0 ? RELEASE_ORDER.filter((p) => named.includes(p)) : [...RELEASE_ORDER];

  return { packages: [...packages], target, issue, dryRun, skipPrompt };
};

const main = async (): Promise<void> => {
  const { packages, target, issue, dryRun, skipPrompt } = parseOptions();

  console.log('\n  Preflight');
  assertPublisherIsBun();
  await assertCleanTree();
  await assertPushed();

  if (!dryRun) {
    assertNpmToken();
  }

  console.log('      ✓ tree clean, HEAD pushed, publisher is bun');

  // Before the install and across the WHOLE workspace: `force-update` rewrites internal ranges, and
  // an install that ran first has already resolved the old ones. Any member with a stale range
  // fails the run, even one this release does not touch.
  console.log('\n  Workspace');
  await $`bun run --filter ${'@venizia/*'} force-update highest`.quiet();
  await $`bun install`.quiet();
  console.log('      ✓ ranges refreshed, workspace installed');

  // CI throws its checkout away, so a range `force-update` repaired outside the released package
  // vanishes with the runner and is repaired again next release. Here it persists - which is the
  // better outcome, but only if it is said out loud: otherwise the next run's clean-tree guard
  // refuses on a change nobody remembers making.
  const repaired = (await $`git status --porcelain`.text())
    .trim()
    .split('\n')
    .filter((line) => line.endsWith('package.json'))
    .map((line) => line.slice(3));

  if (repaired.length > 0) {
    console.log(`      ⚠ force-update repaired ${repaired.length} stale range(s) - commit these:`);
    for (const file of repaired) {
      console.log(`          ${file}`);
    }
  }

  console.log(
    `\n  Releasing ${packages.length} package(s) as '${target}'${dryRun ? ' [DRY RUN]' : ''}:\n    ${packages.join(' → ')}`,
  );

  if (!skipPrompt && !dryRun) {
    process.stdout.write('\n  Continue? [y/N] ');
    const answer = (await new Response(Bun.stdin.stream()).text()).trim().toLowerCase();

    if (answer !== 'y') {
      console.log('  Aborted.\n');
      return;
    }
  }

  // The packages this run published: the next one's registry gate trusts their workspace version
  // while npm is still catching up (the workflow's `chain_released`).
  const chainReleased: string[] = [];

  for (const name of packages) {
    await releasePackage({ name, target, issue, chainReleased, dryRun });

    if (!dryRun) {
      chainReleased.push(readManifest(resolvePackagePath(name)).name as string);
    }
  }

  console.log(`\n  ✓ ${dryRun ? 'Dry run complete' : 'Release complete'}\n`);
};

await main();
