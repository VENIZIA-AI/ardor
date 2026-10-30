/**
 * What the operator checks after a release run: the registry holds what the run claims to have
 * published, and the local `develop` has the commits the run pushed.
 *
 * A green workflow is not proof of a publish. The release publishes BEFORE it commits, so a run can put a
 * version on npm and still fail afterwards, and the reverse (a green run whose publish silently did
 * nothing) is exactly what this catches. The registry and the clock are injected so a test can reach it.
 */

interface IPublishedState {
  /** The npm name. */
  packageName: string;
  /** Every version on the registry before the dispatch; a new one is the proof of a publish. */
  publishedVersions: readonly string[];
}

const DEFAULT_ATTEMPTS = 48;
const DEFAULT_INTERVAL_MS = 5_000;

export class ReleaseVerify {
  /**
   * The version that appeared on the registry after the dispatch. A version absent before the dispatch,
   * not a dist-tag: a stable release goes to `latest` and leaves `next` where it was. Four minutes by
   * default, because the registry can lag the publish.
   */
  static async assertPublished(opts: {
    state: IPublishedState;
    listVersions: (listOpts: { packageName: string }) => Promise<string[]>;
    sleepFn?: (ms: number) => Promise<void>;
    attempts?: number;
    intervalMs?: number;
  }): Promise<string> {
    const {
      state,
      listVersions,
      sleepFn = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
      attempts = DEFAULT_ATTEMPTS,
      intervalMs = DEFAULT_INTERVAL_MS,
    } = opts;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const versions = await listVersions({ packageName: state.packageName });
      const fresh = versions.find((version) => !state.publishedVersions.includes(version));

      if (fresh) {
        return fresh;
      }

      await sleepFn(intervalMs);
    }

    throw new Error(
      `${state.packageName} shows no new version on the registry after ${Math.round((attempts * intervalMs) / 60_000)} minutes. Check \`npm view ${state.packageName} versions\` before assuming it failed - the registry may simply be lagging.`,
    );
  }

  /**
   * Every planned package shows a new version, then the local `develop` is pulled once (fast-forward
   * only): the workflow pushes its own release commits, and without the pull the operator reads a
   * repository that disagrees with the registry.
   */
  static async verifyRun(opts: {
    states: readonly IPublishedState[];
    listVersions: (listOpts: { packageName: string }) => Promise<string[]>;
    pull: () => Promise<void>;
    sleepFn?: (ms: number) => Promise<void>;
    attempts?: number;
    intervalMs?: number;
  }): Promise<Record<string, string>> {
    const { states, listVersions, pull, sleepFn, attempts, intervalMs } = opts;
    const published: Record<string, string> = {};

    for (const state of states) {
      const result = await ReleaseVerify.assertPublished({
        state,
        listVersions,
        sleepFn,
        attempts,
        intervalMs,
      });
      published[state.packageName] = result;
    }

    await pull();

    return published;
  }
}
