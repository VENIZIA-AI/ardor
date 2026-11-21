import { ConstClass } from '@venizia/ignis-helpers/common';
import { describe, expect, test } from 'bun:test';

class Panels extends ConstClass {
  static readonly LEFT = 'left';
  static readonly RIGHT = 'right';
}

class WidePanels extends Panels {
  static readonly CENTER = 'center';
}

describe('a ConstClass subclass in the browser test environment', () => {
  test('runs with a document', () => {
    expect(typeof document).toBe('object');
  });

  test('reads its values, base class first', () => {
    expect(Panels.values()).toEqual(['left', 'right']);
    expect(WidePanels.values()).toEqual(['left', 'right', 'center']);
  });

  test('isValid accepts its values, rejects anything else and narrows the type', () => {
    const input: unknown = 'left';

    if (!Panels.isValid(input)) {
      throw new Error('left is a panel');
    }

    const panel: 'left' | 'right' = input;
    expect(panel).toBe('left');
    expect(Panels.isValid('top')).toBe(false);
    expect(Panels.isValid(undefined)).toBe(false);
  });
});
