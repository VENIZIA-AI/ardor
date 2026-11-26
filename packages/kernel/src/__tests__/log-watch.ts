import { spyOn } from 'bun:test';

import { LoggerFactory } from '@venizia/ignis-helpers/core';

/** Silences one logger method for the running test, so the test asserts the calls instead. */
export class LogWatch {
  private static readonly restores: Array<() => void> = [];

  static on(opts: { scope: string; method: 'error' | 'warn' }) {
    const spy = spyOn(LoggerFactory.getLogger([opts.scope]), opts.method).mockImplementation(
      () => undefined,
    );
    LogWatch.restores.push(() => spy.mockRestore());

    return spy;
  }

  static restore(): void {
    for (const restore of LogWatch.restores.splice(0)) {
      restore();
    }
  }
}
