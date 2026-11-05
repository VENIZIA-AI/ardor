import React from 'react';

import { ElementTargets, type TElementTarget } from './element-target';
import { type IResizeObservation, ResizeObservation, type TResizeBox } from './resize-observation';

/** What `useResizeEffect` watches and the callback it calls. */
export interface IUseResizeEffectOptions {
  /** Read after every render: an element, a ref to one, or `null`, which is skipped. */
  targets: TElementTarget[];
  /** Receives the latest entry of each element that resized since the last call. */
  onResize: (entries: ResizeObserverEntry[]) => void;
  /** @default 'content-box' */
  box?: TResizeBox;
  /** Also observe the direct children of each target, and again whenever they change. @default false */
  children?: boolean;
  /**
   * Call `onResize` inside the `ResizeObserver` callback, after layout and before paint, instead of on
   * the next animation frame, so what it draws shows in the frame that resized. It then runs once per
   * observer callback, not once per frame.
   * @default false
   */
  beforePaint?: boolean;
}

/**
 * Calls `onResize` at most once per animation frame when any of the targets resizes (inside the
 * observer callback, before paint, with `beforePaint`). A new
 * `onResize` is used without observing again, and the targets are read after every render, so an
 * element held in state, a ref whose element changed and a list that grows or shrinks are followed.
 *
 * @example
 * ```tsx
 * import React from 'react';
 * import { useResizeEffect } from '@venizia/ardor';
 *
 * export function Panel() {
 *   const ref = React.useRef<HTMLDivElement>(null);
 *   useResizeEffect({ targets: [ref], onResize: (entries) => console.log(entries.length) });
 *   return <div ref={ref} />;
 * }
 * ```
 */
export const useResizeEffect = (opts: IUseResizeEffectOptions): void => {
  const { targets, onResize, box = 'content-box', children = false, beforePaint = false } = opts;
  const handleResize = React.useRef(onResize);
  const observation = React.useRef<IResizeObservation>(undefined);

  React.useEffect(() => {
    handleResize.current = onResize;

    return () => {};
  }, [onResize]);

  React.useEffect(() => {
    const created = ResizeObservation.observe({
      box,
      children,
      beforePaint,
      onFrame: (entries) => handleResize.current(entries),
    });
    observation.current = created;

    return created.stop;
  }, [box, children, beforePaint]);

  React.useEffect(() => {
    observation.current?.sync(
      targets.flatMap((target) => ElementTargets.resolve({ target }) ?? []),
    );
  });
};
