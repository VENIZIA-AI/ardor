/** The one reading of `HeadersInit` the network layer uses. */
export class NetworkHeaders {
  /**
   * `HeadersInit` (or a record with number values) as a plain record, keys lowercased: header names
   * are case-insensitive but object keys are not, and two spellings of one name would reach the wire
   * joined as `"1, 0"`.
   */
  static toRecord(opts: {
    headers?: HeadersInit | Record<string, string | number>;
  }): Record<string, string> {
    const { headers } = opts;

    if (!headers) {
      return {};
    }

    const entries: Array<[string, string | number]> = (() => {
      if (headers instanceof Headers) {
        return [...headers.entries()];
      }
      return Array.isArray(headers) ? headers : Object.entries(headers);
    })();

    const rs: Record<string, string> = {};
    for (const [key, value] of entries) {
      rs[key.toLowerCase()] = String(value);
    }

    return rs;
  }

  /** Merge header sources so a later source REPLACES an earlier one, whatever case either used. */
  static merge(opts: {
    sources: Array<HeadersInit | Record<string, string | number> | undefined>;
  }): Record<string, string> {
    return opts.sources.reduce<Record<string, string>>((acc, headers) => {
      return Object.assign(acc, NetworkHeaders.toRecord({ headers }));
    }, {});
  }
}
