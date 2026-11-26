import type { IDataProvider } from '@/common';
import { RequestMethods } from '@venizia/ardor-kernel';
import { ErrorStatusUtility } from './error-status';

export class CheckAuthUtility {
  /** The `checkAuth` request. `isStale` is a 401 that answers a user who is gone (`SESSION_CHANGED_CODE`): it has no answer. */
  static async ask(opts: { dataProvider: IDataProvider; resource: string }) {
    try {
      const response = await opts.dataProvider.send({
        resource: opts.resource,
        params: { method: RequestMethods.GET },
      });

      return { response, isStale: false };
    } catch (error) {
      if (ErrorStatusUtility.isSessionChanged({ error })) {
        return { response: undefined, isStale: true };
      }

      throw error;
    }
  }
}
