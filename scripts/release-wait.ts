/**
 * Waiting for a published package to be installable.
 *
 * `npm view <pkg>@next version` reads the packument, and the packument is listed minutes before the
 * tarball answers: `bun install` on the version fails with a 404 in that window. The next package
 * of a release chain runs its clean-install gate against the one before it, so the chain waits for
 * the tarball itself, not for the dist-tag.
 */

const REGISTRY = 'https://registry.npmjs.org';

type TFetch = (url: string, init?: { method?: string }) => Promise<{ ok: boolean; status: number }>;

/** `https://registry.npmjs.org/@scope/name/-/name-1.2.3.tgz`: the file is named by the unscoped name. */
const tarballUrl = (opts: { packageName: string; version: string }): string => {
  const unscoped = opts.packageName.split('/').pop() ?? opts.packageName;
  return `${REGISTRY}/${opts.packageName}/-/${unscoped}-${opts.version}.tgz`;
};

/**
 * Polls the tarball URL until it answers 2xx. A 404 and a network error both mean "not yet": the
 * registry is eventually consistent, and a dropped connection says nothing about the package.
 * Fifteen minutes by default, because the lag has been seen at several minutes.
 */
const waitForTarball = async (opts: {
  packageName: string;
  version: string;
  fetchFn?: TFetch;
  sleepFn?: (ms: number) => Promise<void>;
  intervalMs?: number;
  attempts?: number;
}): Promise<void> => {
  const {
    packageName,
    version,
    fetchFn = fetch,
    sleepFn = ms => new Promise<void>(resolve => setTimeout(resolve, ms)),
    intervalMs = 5_000,
    attempts = 180,
  } = opts;

  const url = tarballUrl({ packageName, version });

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchFn(url, { method: 'HEAD' }).catch(() => undefined);
    if (response?.ok) {
      return;
    }

    if (attempt < attempts) {
      await sleepFn(intervalMs);
    }
  }

  throw new Error(
    `${packageName}@${version} is listed on the registry, but its tarball still does not answer 200 after ${Math.round((attempts * intervalMs) / 60_000)} minutes (${url}). The next package would fail its clean install; check the registry before dispatching it.`,
  );
};

export { tarballUrl, waitForTarball };
