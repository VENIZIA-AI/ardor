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
    sleepFn = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
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

/** How often a run that waits for approval is reported again: every thirty polls, five minutes at the default interval. */
const WAITING_REPORT_EVERY = 30;

/**
 * Polls a run until it completes and returns its conclusion. A run that waits for a person to approve
 * it (status `waiting`) is waited for as long as it waits: there is no deadline, because the approval
 * is a human step. The first poll of the wait and every thirty polls after it are reported, so the
 * operator sees what the driver is waiting for.
 */
const waitForCompletion = async (opts: {
  runId: string;
  readRun: (opts: { runId: string }) => Promise<{ status: string; conclusion: string }>;
  sleepFn?: (ms: number) => Promise<void>;
  intervalMs?: number;
  onWaiting?: (opts: { runId: string; polls: number }) => void;
}): Promise<string> => {
  const {
    runId,
    readRun,
    sleepFn = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    intervalMs = 10_000,
    onWaiting,
  } = opts;

  let waitingPolls = 0;

  for (;;) {
    const { status, conclusion } = await readRun({ runId });

    if (status === 'completed') {
      return conclusion;
    }

    if (status === 'waiting') {
      waitingPolls += 1;

      if ((waitingPolls - 1) % WAITING_REPORT_EVERY === 0) {
        onWaiting?.({ runId, polls: waitingPolls });
      }
    } else {
      waitingPolls = 0;
    }

    await sleepFn(intervalMs);
  }
};

export { tarballUrl, waitForCompletion, waitForTarball };
