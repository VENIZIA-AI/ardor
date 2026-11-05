import type { TExtraRequest } from '@venizia/ignis-kernel/repository';
import type { GetListParams } from 'ra-core';

import { type ICustomParams, ValueUtility } from '@venizia/ardor-kernel';

/** The IGNIS filter a list request sends. Any other key of the list params is a filter key too. */
export interface IListFilter {
  where: Record<string, unknown>;
  /** Each entry is `'<field> <ASC|DESC>'`. */
  order?: Array<string>;
  limit?: number;
  /** IGNIS's offset; `ListFilterBuilder.build` sets this one. */
  skip?: number;
  include?: unknown;
  fields?: unknown;
  /** Not part of the filter sent: `ListFilterBuilder.build` moves it into the query string. */
  params?: Record<string, unknown>;
  /** Lifts `limit` and `skip`: the list is not paginated. */
  noLimit?: boolean;
  [key: string]: unknown;
}

/** Builds the filter, query and extras of a list request from react-admin's list params. */
export class ListFilterBuilder {
  /** `filter.params` as the keys of the query string, as a copy. */
  static extractQueryParams(opts: { params?: Record<string, unknown> }): Record<string, unknown> {
    return { ...opts.params };
  }

  /**
   * The filter, query and list extras a list request sends, from react-admin's list params:
   * pagination into `limit`/`skip`, sort into `order`, `noLimit` lifting both, the remaining params
   * into the filter, `filter.params` and `meta` into the query, and `meta.extra` into the list
   * extras (sent in a header).
   */
  static build(opts: { params: GetListParams & ICustomParams }): {
    filter: IListFilter;
    queryKey: Record<string, unknown>;
    extra: TExtraRequest | undefined;
  } {
    const { pagination, sort, filter: filterInput, meta, ...rest } = opts.params;

    let filter = {} as IListFilter;

    if (filterInput?.where) {
      filter = { ...filterInput, where: { ...filterInput.where } };
    } else {
      const { include, fields, params, noLimit, ...where } = filterInput ?? {};

      filter['where'] = where;
      filter['include'] = include;
      filter['fields'] = fields;
      filter['params'] = params;
      filter['noLimit'] = noLimit;
    }

    if (sort?.field) {
      filter['order'] = [`${sort.field} ${sort.order}`];
    }

    // Remove default limit and skip in react-admin
    if (filter?.noLimit) {
      filter['limit'] = undefined;
      filter['skip'] = undefined;
      filter['offset'] = undefined;
      filter['noLimit'] = undefined;
    } else {
      const { page = 1, perPage = 0 } = pagination ?? {};

      // No `perPage` is no limit. `skip` is IGNIS's offset.
      if (perPage > 0) {
        filter['limit'] = perPage;
        filter['skip'] = (Math.max(page, 1) - 1) * perPage;
      }
    }

    for (const key in rest) {
      // Skip only undefined and null: `false` and `0` are filters.
      if (!ValueUtility.isDefined(rest[key])) {
        continue;
      }

      filter[key] = rest[key];
    }

    const queryKey = ListFilterBuilder.extractQueryParams({ params: filter?.params });

    if (filter?.params) {
      filter['params'] = undefined;
    }

    // `meta.extra` asks for list extras, in a header; every other `meta` key goes into the query.
    const { extra, ...queryMeta } = meta ?? {};

    for (const key in queryMeta) {
      queryKey[key] = queryMeta[key];
    }

    return { filter, queryKey, extra };
  }
}
