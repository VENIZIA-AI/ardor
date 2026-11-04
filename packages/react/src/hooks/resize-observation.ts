/** The boxes `useElementSize` and `useResizeEffect` read. */
export type TResizeBox = Exclude<ResizeObserverBoxOptions, 'device-pixel-content-box'>;

export interface IResizeObservationOptions {
  box: TResizeBox;
  /** Also observe the direct children of each target, and again whenever they change. */
  children?: boolean;
  /** Called at most once per animation frame, with the latest entry of each element that resized. */
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
    const { box, children = false, onFrame } = opts;
    if (typeof ResizeObserver === 'undefined') {
      return { sync: () => {}, stop: () => {} };
    }

    const latest = new Map<Element, ResizeObserverEntry>();
    let watched = new Set<Element>();
    let current: Element[] = [];
    let frame: number | undefined;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        latest.set(entry.target, entry);
      }
      if (frame !== undefined) {
        return;
      }

      frame = requestAnimationFrame(() => {
        frame = undefined;
        const batch = [...latest.values()];
        latest.clear();
        if (batch.length > 0) {
          onFrame(batch);
        }
      });
    });

    const update = (targets: Element[]) => {
      const wanted = new Set(
        children ? targets.flatMap((target) => [target, ...target.children]) : targets,
      );
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

    const mutations = children ? new MutationObserver(() => update(current)) : undefined;

    return {
      sync: (targets) => {
        current = targets;
        update(targets);
        for (const target of targets) {
          mutations?.observe(target, { childList: true });
        }
      },
      stop: () => {
        mutations?.disconnect();
        observer.disconnect();
        if (frame !== undefined) {
          cancelAnimationFrame(frame);
        }
      },
    };
  }
}
