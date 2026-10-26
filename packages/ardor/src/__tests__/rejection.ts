import { getError } from '@venizia/ignis-inversion';

/**
 * The value a task rejects with; throws when it resolves instead, which fails the test.
 *
 * Bun types the `rejects` matchers as `void`, so `await expect(task).rejects.toThrow()` is refused by
 * `typescript/await-thenable`, and an un-awaited one never asserts.
 */
export const getRejection = async (opts: { task: Promise<unknown> }): Promise<unknown> => {
  try {
    await opts.task;
  } catch (error) {
    return error;
  }

  throw getError({ message: '[getRejection] Expected the task to reject, but it resolved' });
};
