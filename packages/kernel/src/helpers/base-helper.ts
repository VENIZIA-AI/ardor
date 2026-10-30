import { Logger } from './logger';

/** @deprecated Use `BaseHelper` from `@venizia/ignis-helpers/core`. Removed in 0.5. */
export class BaseHelper {
  protected logger: Logger;

  constructor(opts: { scope: string }) {
    this.logger = Logger.getInstance({ scope: opts.scope });
  }
}
