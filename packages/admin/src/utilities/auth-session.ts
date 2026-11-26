import { getError, isApplicationError } from '@venizia/ignis-inversion';

import { RequestMethods, SESSION_CHANGED_CODE } from '@venizia/ardor-kernel';
import type { IDataProvider } from '@/common';

/** What `DefaultAuthProvider` does with a session that needs none of its state. */
export class AuthSessionUtility {
  /** Whether it is the 401 of a request whose session has ended since (`SESSION_CHANGED_CODE`). */
  static isSessionChanged(opts: { error: unknown }): boolean {
    const { error } = opts;

    return isApplicationError(error) && error.normalized.code === SESSION_CHANGED_CODE;
  }

  /** react-admin's `HttpError` has `status`, the data provider's `ApplicationError` has `statusCode`. */
  static readStatus(opts: { error: unknown }): unknown {
    const { error } = opts;

    if (typeof error !== 'object' || error === null) {
      return undefined;
    }

    const status = 'status' in error ? error.status : undefined;

    return status ?? ('statusCode' in error ? error.statusCode : undefined);
  }

  /** The `checkAuth` request. `isStale` is a 401 that answers a user who is gone (`SESSION_CHANGED_CODE`): it has no answer. */
  static async askCheckAuth(opts: { dataProvider: IDataProvider; resource: string }) {
    try {
      const response = await opts.dataProvider.send({
        resource: opts.resource,
        params: { method: RequestMethods.GET },
      });

      return { response, isStale: false };
    } catch (error) {
      if (AuthSessionUtility.isSessionChanged({ error })) {
        return { response: undefined, isStale: true };
      }

      throw error;
    }
  }

  /** Runs `run` and rejects when it has not settled within `milliseconds`. */
  static async settleWithin(opts: {
    run: () => void | Promise<void>;
    milliseconds: number;
  }): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(getError({ message: `did not settle in ${opts.milliseconds} ms` }));
      }, opts.milliseconds);
    });

    try {
      await Promise.race([opts.run(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
