import { act, screen, type ByRoleOptions } from '@testing-library/react';

const MAX_TURNS = 200;
const TURN_MS = 5;

/**
 * Queries that wait in turns inside `act`: react-admin updates state after the first render, and React
 * expects each of those updates to be applied there.
 */
export class ActScreen {
  /** One turn: the updates that are due are applied. */
  static settle(): Promise<void> {
    return act(() => Bun.sleep(TURN_MS));
  }

  /** Waits until `isDone`, or for the last turn, and then one turn more. The caller asserts. */
  static async until(isDone: () => boolean): Promise<void> {
    for (let turn = 0; turn < MAX_TURNS && !isDone(); turn++) {
      await ActScreen.settle();
    }

    await ActScreen.settle();
  }

  static async findByText(text: string): Promise<HTMLElement> {
    await ActScreen.until(() => screen.queryAllByText(text).length > 0);

    return screen.getByText(text);
  }

  static async findByRole(role: string, options: ByRoleOptions): Promise<HTMLElement> {
    await ActScreen.until(() => screen.queryAllByRole(role, options).length > 0);

    return screen.getByRole(role, options);
  }
}
