import type { ILogger } from '@venizia/ignis-helpers/core';

/**
 * What happens after a 401: one refresh shared by every request in flight, and which paths may
 * recover at all. The callbacks are read when called, so a subclass override of the service hooks
 * behind them takes effect.
 */
export class AuthRecovery {
  /** The refresh in flight for each session (`key`): a request of another session never joins it. */
  private readonly refreshing = new Map<string, Promise<boolean>>();

  constructor(
    private readonly opts: {
      logger: ILogger;
      /** Read per request: the service lets its `authRecovery` be set after construction. */
      getRefreshTokenPath: () => string | undefined;
      /** `true`: refreshed, `false`: this service has no refresh, a throw: it failed. */
      refresh: () => Promise<boolean>;
      /** Runs once when the refresh threw. */
      onFailure: () => Promise<void>;
      /** Whether the request, given by its paths, goes without a token; such a request never recovers. */
      isNoAuthPath: (paths: string[]) => boolean;
    },
  ) {}

  /**
   * Once for every 401 in flight of one session (`key`): those callers share one `refresh`. A 401 of
   * another session starts its own, so it never waits for an answer that belongs to someone else.
   * `true` when the token was refreshed.
   */
  refresh(opts: { key?: string } = {}): Promise<boolean> {
    const { logger, refresh, onFailure } = this.opts;
    const { key = '' } = opts;
    const inFlight = this.refreshing.get(key);

    if (inFlight) {
      return inFlight;
    }

    // A refresh that throws synchronously is still a failed refresh, not a stray exception.
    const started = Promise.resolve()
      .then(() => refresh())
      .catch(async (error) => {
        logger.error('[refresh] refreshToken failed | error: %o', error);

        try {
          await onFailure();
        } catch (failure) {
          logger.error('[refresh] onAuthFailure failed | error: %o', failure);
        }

        return false;
      })
      .finally(() => {
        this.refreshing.delete(key);
      });
    this.refreshing.set(key, started);

    return started;
  }

  /** Not for a no-auth path, nor for the refresh path itself, which would wait on itself. */
  canRecover(opts: { paths: string[] }): boolean {
    const { paths } = opts;

    if (this.opts.isNoAuthPath(paths)) {
      return false;
    }

    const refreshTokenPath = this.opts.getRefreshTokenPath();

    if (refreshTokenPath && paths?.join('/').includes(refreshTokenPath)) {
      return false;
    }

    return true;
  }
}
