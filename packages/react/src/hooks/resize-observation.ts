/** The boxes `useElementSize` and `useResizeEffect` read. */
export type TResizeBox = Exclude<ResizeObserverBoxOptions, 'device-pixel-content-box'>;

export interface IResizeObservationOptions {
  box: TResizeBox;
  /** Also observe the direct children of each target, and again whenever they change. @default false */
  children?: boolean;
  /** Call `onFrame` inside the `ResizeObserver` callback, after layout and before paint, instead of on the next animation frame. */
  beforePaint?: boolean;
  /** Called with the latest entry of each element that resized: at most once per animation frame, or once per observer callback with `beforePaint`. */
  onFrame: (entries: ResizeObserverEntry[]) => void;
}

export interface IResizeObservation {
  /** Observes these elements and stops observing the ones no longer listed. */
  sync: (targets: Element[]) => void;
  stop: () => void;
}

export class ResizeObservation {
  /** Does nothing without `ResizeObserver`. */
  static observe(opts: IResizeObservationOptions): IResizeObservation {
    const { box, children = false, beforePaint = false, onFrame } = opts;

    if (typeof ResizeObserver === 'undefined') {
      return { sync: () => {}, stop: () => {} };
    }

    const latest = new Map<Element, ResizeObserverEntry>();
    let watched = new Set<Element>();
    let current: Element[] = [];
    let frame: number | undefined;

    const flush = () => {
      const batch = [...latest.values()];
      latest.clear();

      if (batch.length > 0) {
        onFrame(batch);
      }
    };

    let observer: ResizeObserver | undefined;

    const onEntries: ResizeObserverCallback = (entries) => {
      for (const entry of entries) {
        latest.set(entry.target, entry);
      }

      if (beforePaint) {
        flush();

        return;
      }

      if (frame !== undefined) {
        return;
      }

      frame = requestAnimationFrame(() => {
        frame = undefined;
        flush();
      });
    };

    const update = (targets: Element[]) => {
      const wanted = new Set(
        children ? targets.flatMap((target) => [target, ...target.children]) : targets,
      );

      // No target and no observer yet: there is nothing to watch, so none is made.
      if (!observer && wanted.size === 0) {
        return;
      }

      observer ??= new ResizeObserver(onEntries);

      for (const element of watched) {
        if (!wanted.has(element)) {
          observer.unobserve(element);
          latest.delete(element);
        }
      }

      for (const element of wanted) {
        if (!watched.has(element)) {
          observer.observe(element, { box });
        }
      }

      watched = wanted;
    };

    let mutations: MutationObserver | undefined;

    return {
      sync: (targets) => {
        if (
          targets.length === current.length &&
          targets.every((target, index) => target === current[index])
        ) {
          return;
        }

        current = targets;
        update(targets);

        // A removed target stays registered on `mutations` until `stop`; its callback only updates the current targets.
        if (children && targets.length > 0) {
          mutations ??= new MutationObserver(() => update(current));

          for (const target of targets) {
            mutations.observe(target, { childList: true });
          }
        }
      },
      stop: () => {
        mutations?.disconnect();
        observer?.disconnect();

        if (frame !== undefined) {
          cancelAnimationFrame(frame);
        }
      },
    };
  }
}
