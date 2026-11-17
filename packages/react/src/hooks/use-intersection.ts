import React from 'react';

import { ElementTargets, type TElementTarget } from './element-target';

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

interface IScope {
  /** In target order, `null` for a target with no element yet. */
  elements: Array<Element | null>;
  root: Element | null;
  /** A `root` ref whose element is not there yet: nothing is observed until it is. */
  isRootPending: boolean;
}

const EMPTY_SCOPE: IScope = { elements: [], root: null, isRootPending: false };
const NO_ENTRIES = new Map<Element, IntersectionObserverEntry>();

const resolveScope = (opts: Pick<IUseIntersectionOptions, 'target' | 'root'>): IScope => {
  const { target, root } = opts;
  const targets = Array.isArray(target) ? target : [target];
  const rootElement = root === undefined ? null : ElementTargets.resolve({ target: root });

  return {
    elements: targets.map((item) => ElementTargets.resolve({ target: item })),
    root: rootElement,
    isRootPending: rootElement === null && root !== undefined && root !== null,
  };
};

const sameScope = (a: IScope, b: IScope): boolean => {
  return (
    a.root === b.root &&
    a.isRootPending === b.isRootPending &&
    a.elements.length === b.elements.length &&
    a.elements.every((element, index) => element === b.elements[index])
  );
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
  const [scope, setScope] = React.useState<IScope>(EMPTY_SCOPE);
  const [entries, setEntries] = React.useState(NO_ENTRIES);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- the target and root are read after every render, and a state set to an equal scope renders nothing
  React.useEffect(() => {
    const next = resolveScope({ target, root });

    setScope((current) => (sameScope(current, next) ? current : next));
  });

  React.useEffect(() => {
    setEntries((current) => (current.size === 0 ? current : NO_ENTRIES));

    const watched = new Set(scope.elements.filter((element) => element !== null));

    if (watched.size === 0 || scope.isRootPending || typeof IntersectionObserver === 'undefined') {
      return () => {};
    }

    const observer = new IntersectionObserver(
      (delivered) => {
        setEntries((current) => {
          let next = current;

          for (const entry of delivered) {
            const known = next.get(entry.target);

            if (
              known?.isIntersecting === entry.isIntersecting &&
              known.intersectionRatio === entry.intersectionRatio
            ) {
              continue;
            }

            if (next === current) {
              next = new Map(current);
            }

            next.set(entry.target, entry);
          }

          return next;
        });
      },
      {
        root: scope.root ?? undefined,
        rootMargin,
        threshold: thresholdKey === undefined ? undefined : JSON.parse(thresholdKey),
      },
    );

    for (const element of watched) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [scope, rootMargin, thresholdKey]);

  return React.useMemo(() => {
    const read = Array.from({ length: count }, (_, index): TEntry => {
      const element = scope.elements[index];

      return element ? entries.get(element) : undefined;
    });

    return isList ? read : read[0];
  }, [count, isList, scope, entries]);
}
