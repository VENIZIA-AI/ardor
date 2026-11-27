import { RecordUtility } from '@venizia/ignis-helpers/core';
import type { RaRecord } from 'ra-core';

import { NetworkResponseReader, RequestTypes, type TRequestType } from '@venizia/ardor-kernel';
import type { TExtraRequest } from '@venizia/ignis-kernel/repository';
import type { IListFilter } from './list-filter';
import { DefaultRestDataProvider } from './rest-data';
import { WireMethods } from '@/utilities/wire-methods';

/**
 * For a backend whose list routes send no `Content-Range`: the list reads take their `total` from
 * a count route (`GET /{resource}/count` with the same `where`), a second request per list.
 *
 * Keep the default, `DefaultRestDataProvider`, otherwise: it reads the total from the
 * `Content-Range` that the list routes of an IGNIS CRUD controller send. A browser on another origin
 * sees that header only when the server exposes it (CORS `Access-Control-Expose-Headers`).
 */
export class CountRestDataProvider<
  TResource extends string = string,
> extends DefaultRestDataProvider<TResource> {
  /**
   * Sends the list GET and the count GET together; `total` is the count's `count`, a non-negative
   * integer or a string of digits, or `0` when the count answers none. Any other gives `0` and a warning.
   * Rejects when either request rejects.
   */
  protected override requestList<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, unknown>;
    filter: IListFilter;
    extra?: TExtraRequest;
    signal?: AbortSignal;
  }) {
    const { resource, queryKey, filter, signal } = opts;

    // The base class reads the rows and keeps the route's list extras as `meta.extra`.
    const list = super.requestList<RecordType>(opts);

    // The count route has no extras: its request carries none.
    const count = this.request({
      resource,
      type: RequestTypes.SEND,
      method: WireMethods.GET,
      paths: [resource, 'count'],
      query: { ...queryKey, where: filter?.where },
      signal,
    });

    return Promise.all([list, count]).then(([listResult, countResult]) => {
      const counted = RecordUtility.read({ value: countResult.data, path: ['count'] });

      return {
        data: listResult.data,
        total: this.toTotal({ counted, resource }),
        ...('meta' in listResult && listResult.meta ? { meta: listResult.meta } : {}),
      };
    });
  }

  /** The `count` of a count answer as a total. */
  private toTotal(opts: { counted: unknown; resource: TResource }): number {
    const { counted, resource } = opts;

    if (counted === undefined || counted === null) {
      return 0;
    }

    const total = NetworkResponseReader.parseCount({ count: counted });

    if (total !== undefined) {
      return total;
    }

    this.logger.warn(
      '[requestList] The count is no non-negative integer, total is 0 | route: %s | count: %o',
      `/${resource}/count`,
      counted,
    );

    return 0;
  }
}
