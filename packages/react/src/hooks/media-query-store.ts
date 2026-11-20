/** The one place that talks to `window.matchMedia`: `useMediaQuery` and `useBreakpoint` read and subscribe through it. */
export class MediaQueryStore {
  /** Whether the query matches now. */
  static matches(opts: { query: string }): boolean {
    return window.matchMedia(opts.query).matches;
  }

  /** Calls `listener` when any of the queries changes; the returned function stops listening to all of them. */
  static subscribe(opts: { queries: Array<string>; listener: () => void }): () => void {
    const { queries, listener } = opts;
    const lists = queries.map((query) => window.matchMedia(query));

    for (const list of lists) {
      list.addEventListener('change', listener);
    }

    return () => {
      for (const list of lists) {
        list.removeEventListener('change', listener);
      }
    };
  }
}
