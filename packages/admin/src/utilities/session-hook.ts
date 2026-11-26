import { getError } from '@venizia/ignis-inversion';

export class SessionHookUtility {
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
