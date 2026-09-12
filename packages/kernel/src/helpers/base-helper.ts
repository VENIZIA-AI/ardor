import { Logger } from './logger';

export class BaseHelper {
  protected logger: Logger;

  constructor(opts: { scope: string }) {
    this.logger = Logger.getInstance({ scope: opts.scope });
  }
}
