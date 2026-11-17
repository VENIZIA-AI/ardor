import React from 'react';

import { ResizeObservation, type TResizeBox } from './resize-observation';

/** Which element `useElementSize` measures, which box it reads, and how it rounds. */
export interface IUseElementSizeOptions {
  /** The element to measure. Leave it out to measure the element the returned `ref` is given to. */
  ref?: React.RefObject<Element | null>;
  /** @default 'content-box' */
  box?: TResizeBox;
  /** Round width and height to whole pixels, so a fractional size does not render again. @default false */
  round?: boolean;
}

/** The size `useElementSize` read, in CSS pixels. */
export interface IUseElementSizeReturn {
  width: number;
  height: number;
  /** `false` until the first size is read, so 0 by 0 can be told from a measured empty element. */
  measured: boolean;
}

/** The size of `useElementSize` called without a `ref` option, with the ref to give an element. */
export interface IUseElementSizeRefReturn extends IUseElementSizeReturn {
  /** Give it to the element to measure. */
  ref: React.RefCallback<Element>;
}

const ZERO_SIZE: IUseElementSizeReturn = { width: 0, height: 0, measured: false };

const readSize = (opts: {
  entry: ResizeObserverEntry;
  box: TResizeBox;
  round: boolean;
}): IUseElementSizeReturn => {
  const { entry, box, round } = opts;
  const border = box === 'border-box' ? entry.borderBoxSize?.[0] : undefined;
  const width = border ? border.inlineSize : entry.contentRect.width;
  const height = border ? border.blockSize : entry.contentRect.height;

  return round
    ? { width: Math.round(width), height: Math.round(height), measured: true }
    : { width, height, measured: true };
};

/**
 * The size of an element, kept up to date by a `ResizeObserver` with one state update per animation
 * frame. Pass `ref` to measure `ref.current`, or leave it out and give the returned `ref` to the
 * element: that form follows an element mounted later or replaced. With a `ref` object the element
 * is read when the effect runs, so it follows a new `ref`, `box` or `round`, not a `ref.current`
 * that is replaced later; pass a stable `ref`. A new element, `box` or `round` starts again from
 * 0 by 0 with `measured` false.
 *
 * @example
 * ```tsx
 * import { useElementSize } from '@venizia/ardor';
 *
 * export function Panel() {
 *   const { ref, width, height, measured } = useElementSize();
 *   return <div ref={ref}>{measured ? `${width} x ${height}` : '...'}</div>;
 * }
 * ```
 */
export function useElementSize(
  opts: IUseElementSizeOptions & { ref: React.RefObject<Element | null> },
): IUseElementSizeReturn;
export function useElementSize(
  opts?: Omit<IUseElementSizeOptions, 'ref'>,
): IUseElementSizeRefReturn;

export function useElementSize(
  opts: IUseElementSizeOptions = {},
): IUseElementSizeReturn | IUseElementSizeRefReturn {
  const { ref, box = 'content-box', round = false } = opts;
  const [element, setElement] = React.useState<Element | null>(null);
  const [size, setSize] = React.useState<IUseElementSizeReturn>(ZERO_SIZE);

  React.useEffect(() => {
    setSize((current) => (current.measured ? ZERO_SIZE : current));

    const target = ref ? ref.current : element;

    if (!target) {
      return () => {};
    }

    const observation = ResizeObservation.observe({
      box,
      onFrame: (entries) => {
        const entry = entries.at(-1);

        if (!entry) {
          return;
        }

        const next = readSize({ entry, box, round });
        setSize((current) => {
          return current.measured && current.width === next.width && current.height === next.height
            ? current
            : next;
        });
      },
    });
    observation.sync([target]);

    return observation.stop;
  }, [ref, element, box, round]);

  return ref ? size : { ...size, ref: setElement };
}
