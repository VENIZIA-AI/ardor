/** The boxes `useElementSize` and `useResizeEffect` read. */
export type TResizeBox = Exclude<ResizeObserverBoxOptions, 'device-pixel-content-box'>;

export interface IResizeObservationOptions {
  targets: Element[];
  box: TResizeBox;
  /** Also observe the direct children of each target, and again whenever they change. */
  children?: boolean;
  /** Called at most once per animation frame, with the latest entry of each element that resized. */
  onFrame: (entries: ResizeObserverEntry[]) => void;
}

export class ResizeObservation {
  /** Observes the targets and returns the function that stops it. Does nothing without `ResizeObserver`. */
  static observe(opts: IResizeObservationOptions): () => void {
    const { targets, box, children = false, onFrame } = opts;
    if (targets.length === 0 || typeof ResizeObserver === 'undefined') {
      return () => {};
    }

    const latest = new Map<Element, ResizeObserverEntry>();
    let watched = new Set<Element>();
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

    const sync = () => {
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
    sync();

    const mutations = children ? new MutationObserver(sync) : undefined;
    for (const target of targets) {
      mutations?.observe(target, { childList: true });
    }

    return () => {
      mutations?.disconnect();
      observer.disconnect();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }
}
