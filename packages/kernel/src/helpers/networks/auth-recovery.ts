import type { Logger } from '../logger';

/**
 * What happens after a 401: one refresh shared by every request in flight, and which paths may
 * recover at all. The callbacks are read when called, so a subclass override of the service hooks
 * behind them takes effect.
 */
export class AuthRecovery {
  private refreshing: Promise<boolean> | null = null;

  constructor(
    private readonly opts: {
      logger: Logger;
      /** Read per request: the service lets its `authRecovery` be set after construction. */
      getRefreshTokenPath: () => string | undefined;
      /** `true`: refreshed, `false`: this service has no refresh, a throw: it failed. */
      refresh: () => Promise<boolean>;
      /** Runs once when the refresh threw. */
      onFailure: () => Promise<void>;
      isNoAuthPath: (paths: string[]) => boolean;
    },
  ) {}

  /** Once for every 401 in flight: the callers share one `refresh`. `true` when the token was refreshed. */
  refresh(): Promise<boolean> {
    const { logger, refresh, onFailure } = this.opts;

    // A refresh that throws synchronously is still a failed refresh, not a stray exception.
    this.refreshing ??= Promise.resolve()
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
        this.refreshing = null;
      });

    return this.refreshing;
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
