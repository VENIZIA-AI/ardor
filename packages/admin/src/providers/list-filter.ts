import omit from 'lodash/omit.js';
import type { GetListParams } from 'ra-core';

import { type AnyType, type ICustomParams, isDefined } from '@venizia/ardor-kernel';

export class ListFilterBuilder {
  /** `filter.params` as the keys of the query string, as a copy. */
  static extractQueryParams(opts: { params?: Record<string, AnyType> }): Record<string, AnyType> {
    return { ...opts.params };
  }

  /**
   * The filter, query and list extras a list request sends, from react-admin's list params:
   * pagination into `limit`/`skip`, sort into `order`, `noLimit` lifting both, the remaining params
   * into the filter, `filter.params` and `meta` into the query, and `meta.extra` into the list
   * extras (sent in a header).
   */
  static build(opts: { params: GetListParams & ICustomParams }): {
    filter: Record<string, AnyType>;
    queryKey: Record<string, AnyType>;
    extra: Record<string, AnyType> | undefined;
  } {
    const { pagination, sort, filter: filterInput, meta, ...rest } = opts.params;

    let filter: Record<string, AnyType> = {};

    if (filterInput?.where) {
      filter = { ...filterInput, where: { ...filterInput.where } };
    } else {
      filter['where'] = {
        ...omit(filterInput, ['include', 'params', 'noLimit', 'fields']),
      };
      filter['include'] = filterInput?.include;
      filter['fields'] = filterInput?.fields;
      filter['params'] = filterInput?.params;
      filter['noLimit'] = filterInput?.noLimit;
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

      // No `perPage` is no limit. `skip` is IGNIS's offset (`offset` is its alias): one is enough.
      if (perPage > 0) {
        filter['limit'] = perPage;
        filter['skip'] = (Math.max(page, 1) - 1) * perPage;
      }
    }

    for (const key in rest) {
      // Skip only undefined and null: `false` and `0` are filters.
      if (!isDefined(rest[key])) {
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
