import React from 'react';

export interface IUseElementSizeOptions {
  ref: React.RefObject<Element | null>;
  /** @default 'content-box' */
  box?: 'content-box' | 'border-box';
}

export interface IUseElementSizeReturn {
  width: number;
  height: number;
}

const readSize = (opts: {
  entry: ResizeObserverEntry;
  box: 'content-box' | 'border-box';
}): IUseElementSizeReturn => {
  const { entry, box } = opts;
  const border = box === 'border-box' ? entry.borderBoxSize[0] : undefined;

  return border
    ? { width: border.inlineSize, height: border.blockSize }
    : { width: entry.contentRect.width, height: entry.contentRect.height };
};

/**
 * The size of `ref.current`, kept up to date by a `ResizeObserver` with one state update per
 * animation frame. The element is read when the effect runs: it follows a new `ref` or `box`, not a
 * `ref.current` that is replaced later.
 */
export const useElementSize = (opts: IUseElementSizeOptions): IUseElementSizeReturn => {
  const { ref, box = 'content-box' } = opts;
  const [size, setSize] = React.useState<IUseElementSizeReturn>({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) {
      return () => {};
    }

    let frame: number | undefined;
    let latest: ResizeObserverEntry | undefined;

    const observer = new ResizeObserver((entries) => {
      latest = entries[entries.length - 1];
      if (frame !== undefined) {
        return;
      }

      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (!latest) {
          return;
        }

        const next = readSize({ entry: latest, box });
        setSize((current) => {
          return current.width === next.width && current.height === next.height ? current : next;
        });
      });
    });
    observer.observe(element, { box });

    return () => {
      observer.disconnect();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }, [ref, box]);

  return size;
};
