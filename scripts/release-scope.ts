/**
 * Which files decide whether a package needs releasing. Split from `release.ts`, which runs on
 * import, so the rule can be tested against a real git history.
 */

/** What a consumer installs: the code, the manifest (peers, exports, engines) and the build config. */
export const releaseScopePaths = (opts: { name: string }): string[] => [
  `packages/${opts.name}/src`,
  `packages/${opts.name}/package.json`,
  `packages/${opts.name}/tsconfig.build.json`,
];

const git = (opts: { cwd: string; args: string[] }): string => {
  const proc = Bun.spawnSync(['git', ...opts.args], { cwd: opts.cwd });
  if (proc.exitCode !== 0) {
    throw new Error(
      `[git ${opts.args.join(' ')}] exited ${proc.exitCode}\n${proc.stderr.toString()}`,
    );
  }
  return proc.stdout.toString();
};

/**
 * Files in the release scope changed since the package's own last release commit, committed or
 * not. `Infinity` when the package was never released.
 */
export const countChangedSinceRelease = (opts: { name: string; cwd?: string }): number => {
  const cwd = opts.cwd ?? process.cwd();
  const paths = releaseScopePaths({ name: opts.name });

  const releaseCommit = git({
    cwd,
    args: ['log', '--format=%H %s', '--', `packages/${opts.name}/package.json`],
  })
    .split('\n')
    .find(line => line.includes('release v'))
    ?.split(' ')[0];

  if (!releaseCommit) {
    return Number.POSITIVE_INFINITY;
  }

  const files = new Set<string>();
  for (const line of git({
    cwd,
    args: ['diff', '--name-only', `${releaseCommit}..HEAD`, '--', ...paths],
  }).split('\n')) {
    if (line) {
      files.add(line);
    }
  }
  // Uncommitted work counts too: the plan should say a feature is pending, even though the
  // clean-tree gate still refuses to dispatch it.
  for (const line of git({ cwd, args: ['status', '--porcelain', '--', ...paths] }).split('\n')) {
    const path = line.slice(3).trim();
    if (path) {
      files.add(path);
    }
  }

  return files.size;
};
