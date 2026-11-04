import React from 'react';

import { ElementTargets, type TElementTarget } from './element-target';

export interface IUseIntersectionOptions {
  /** Read after every render: an element, a ref to one, or `null`. */
  target: TElementTarget;
  /** @default '0px' */
  rootMargin?: string;
  /** The ratio of the element in view at which an entry is delivered. @default 0 */
  threshold?: number;
}

/**
 * The latest `IntersectionObserverEntry` of the target, or `undefined` before the first one and
 * where there is no `IntersectionObserver`. The state changes only when `isIntersecting` or the
 * ratio changed. A new element, `rootMargin` or `threshold` starts again from `undefined`.
 */
export const useIntersection = (
  opts: IUseIntersectionOptions,
): IntersectionObserverEntry | undefined => {
  const { target, rootMargin, threshold } = opts;
  const [element, setElement] = React.useState<Element | null>(null);
  const [entry, setEntry] = React.useState<IntersectionObserverEntry>();

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- the target is read after every render, and a state set to the same element renders nothing
  React.useEffect(() => {
    setElement(ElementTargets.resolve({ target }));
  });

  React.useEffect(() => {
    setEntry(undefined);
    if (!element || typeof IntersectionObserver === 'undefined') {
      return () => {};
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries.at(-1);
        if (!latest) {
          return;
        }

        setEntry((current) => {
          return current?.isIntersecting === latest.isIntersecting &&
            current.intersectionRatio === latest.intersectionRatio
            ? current
            : latest;
        });
      },
      { rootMargin, threshold },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [element, rootMargin, threshold]);

  return entry;
};
