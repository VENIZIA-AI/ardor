/**
 * The value a task rejects with; throws when it resolves instead, which fails the test.
 *
 * Bun types the `rejects` matchers as `void`, so `await expect(task).rejects.toThrow()` is refused by
 * `typescript/await-thenable`, and an un-awaited one never asserts. Awaiting the task here keeps the
 * assertion synchronous and typed, with no cast (rule V-C-10).
 */
export const rejectionOf = async (task: Promise<unknown> | undefined): Promise<unknown> => {
  try {
    await task;
  } catch (error) {
    return error;
  }

  throw new Error('[rejectionOf] Expected the task to reject, but it resolved!');
};
