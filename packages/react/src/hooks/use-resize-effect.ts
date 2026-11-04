import React from 'react';

import { ResizeObservation, type TResizeBox } from './resize-observation';

export interface IUseResizeEffectOptions {
  /** Read when the effect runs; pass a stable array. */
  refs: React.RefObject<Element | null>[];
  /** Receives the latest entry of each element that resized since the last call. */
  onResize: (entries: ResizeObserverEntry[]) => void;
  /** @default 'content-box' */
  box?: TResizeBox;
  /** Also observe the direct children of each ref, and again whenever they change. @default false */
  children?: boolean;
}

/**
 * Calls `onResize` at most once per animation frame when any of the elements resizes. A new
 * `onResize` is used without observing again.
 */
export const useResizeEffect = (opts: IUseResizeEffectOptions): void => {
  const { refs, onResize, box = 'content-box', children = false } = opts;
  const handleResize = React.useRef(onResize);

  React.useEffect(() => {
    handleResize.current = onResize;
    return () => {};
  }, [onResize]);

  React.useEffect(() => {
    return ResizeObservation.observe({
      targets: refs.flatMap((ref) => ref.current ?? []),
      box,
      children,
      onFrame: (entries) => handleResize.current(entries),
    });
  }, [refs, box, children]);
};
