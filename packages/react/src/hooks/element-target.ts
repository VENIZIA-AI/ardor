import type React from 'react';

/** An element, a ref to one, or `null` for none yet. */
export type TElementTarget = React.RefObject<Element | null> | Element | null;

export class ElementTargets {
  static resolve(opts: { target: TElementTarget }): Element | null {
    const { target } = opts;

    return target && 'current' in target ? target.current : target;
  }
}
