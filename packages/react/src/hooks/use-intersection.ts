import React from 'react';

import { ElementTargets, type TElementTarget } from './element-target';
import { type IIntersectionScope, IntersectionStore } from './intersection-store';

/** The element or elements `useIntersection` watches, against which root, and when it delivers an entry. */
export interface IUseIntersectionOptions {
  /** Read after every render: an element, a ref to one, or `null`; or a list of them to watch several. */
  target: TElementTarget | TElementTarget[];
  /**
   * The scrolling container the target is measured against. A ref is read after every render, and nothing is
   * observed while its `current` is `null`. A literal `null`, or leaving it out, is the viewport.
   */
  root?: TElementTarget;
  /** @default '0px' */
  rootMargin?: string;
  /** The ratio of the element in view at which an entry is delivered; a number or a list of them. @default 0 */
  threshold?: number | number[];
}

type TEntry = IntersectionObserverEntry | undefined;

const resolveScope = (
  opts: Pick<IUseIntersectionOptions, 'target' | 'root'>,
): IIntersectionScope => {
  const { target, root } = opts;
  const targets = Array.isArray(target) ? target : [target];
  const rootElement = root === undefined ? null : ElementTargets.resolve({ target: root });

  return {
    elements: targets.map((item) => ElementTargets.resolve({ target: item })),
    root: rootElement,
    isRootPending: rootElement === null && root !== undefined && root !== null,
  };
};

/**
 * The latest `IntersectionObserverEntry` of the target, or `undefined` before the first one and where there is
 * no `IntersectionObserver`. The state changes only when `isIntersecting` or the ratio changed.
 *
 * With a list as `target` it returns an array in target order: the latest entry of each target, `undefined` for
 * one with no element or not reported yet. A new element, `root`, `rootMargin` or `threshold` starts again from
 * `undefined` for every target; the browser reports each target again at once.
 *
 * @example
 * ```tsx
 * import React from 'react';
 * import { useIntersection } from '@venizia/ardor';
 *
 * export function Lazy() {
 *   const ref = React.useRef<HTMLDivElement>(null);
 *   const entry = useIntersection({ target: ref, threshold: 0.5 });
 *   return <div ref={ref}>{entry?.isIntersecting ? 'visible' : 'hidden'}</div>;
 * }
 * ```
 */
export function useIntersection(
  opts: IUseIntersectionOptions & { target: TElementTarget[] },
): TEntry[];
export function useIntersection(opts: IUseIntersectionOptions & { target: TElementTarget }): TEntry;
export function useIntersection(opts: IUseIntersectionOptions): TEntry | TEntry[];

export function useIntersection(opts: IUseIntersectionOptions): TEntry | TEntry[] {
  const { target, root, rootMargin, threshold } = opts;
  const isList = Array.isArray(target);
  const count = isList ? target.length : 1;
  // A number list is compared by value, so a list made anew in each render observes nothing again.
  const thresholdKey = threshold === undefined ? undefined : JSON.stringify(threshold);
  const [store] = React.useState(() => new IntersectionStore());
  const { scope, entries } = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    // A server render observes nothing: the store is still empty there.
    store.getSnapshot,
  );

  // Every render: a ref's element changes with nothing else to tell. The store ignores what it observes already.
  React.useEffect(() => {
    store.sync({ scope: resolveScope({ target, root }), rootMargin, thresholdKey });
  });

  React.useEffect(() => () => store.disconnect(), [store]);

  return React.useMemo(() => {
    const read = Array.from({ length: count }, (_, index): TEntry => {
      const element = scope.elements[index];

      return element ? entries.get(element) : undefined;
    });

    return isList ? read : read[0];
  }, [count, isList, scope, entries]);
}
