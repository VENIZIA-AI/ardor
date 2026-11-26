import { spyOn } from 'bun:test';

/**
 * Runs `task` with `console.log` and `console.error` held back, and answers what it printed on each, one
 * entry per call, beside what it returned.
 */
export const captureConsole = <T>(task: () => T) => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined);
  const error = spyOn(console, 'error').mockImplementation(() => undefined);

  try {
    const value = task();

    return {
      value,
      out: log.mock.calls.map((call) => call.join(' ')),
      err: error.mock.calls.map((call) => call.join(' ')),
    };
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
};
