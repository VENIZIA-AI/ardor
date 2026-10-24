import { describe, expect, test } from 'bun:test';
import { ListFilterBuilder } from '@/providers/list-filter';

describe('ListFilterBuilder.extractQueryParams', () => {
  test('copies filter.params into the query keys', () => {
    expect(
      ListFilterBuilder.extractQueryParams({ params: { tenant: 't1', locale: 'vi' } }),
    ).toEqual({
      tenant: 't1',
      locale: 'vi',
    });
  });

  test('is empty without params, and answers a copy, not the caller object', () => {
    expect(ListFilterBuilder.extractQueryParams({})).toEqual({});
    expect(ListFilterBuilder.extractQueryParams({ params: undefined })).toEqual({});

    const params = { tenant: 't1' };
    const copy = ListFilterBuilder.extractQueryParams({ params });
    copy.tenant = 'changed';
    expect(params.tenant).toBe('t1');
  });
});

describe('ListFilterBuilder.build', () => {
  test('turns pagination, sort and plain filter keys into the IGNIS filter', () => {
    const { filter, queryKey, extra } = ListFilterBuilder.build({
      params: {
        pagination: { page: 3, perPage: 20 },
        sort: { field: 'name', order: 'DESC' },
        filter: { status: 'open' },
      },
    });

    expect(filter.where).toEqual({ status: 'open' });
    expect(filter.order).toEqual(['name DESC']);
    expect(filter.limit).toBe(20);
    expect(filter.skip).toBe(40);
    expect(filter.offset).toBeUndefined();
    expect(queryKey).toEqual({});
    expect(extra).toBeUndefined();
  });

  test('keeps a where the caller gave, and routes filter.params and meta into the query', () => {
    const { filter, queryKey, extra } = ListFilterBuilder.build({
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: { where: { kind: 'a' }, params: { tenant: 't1' } },
        meta: { locale: 'vi', extra: { total: true } },
      },
    });

    expect(filter.where).toEqual({ kind: 'a' });
    expect(filter.params).toBeUndefined();
    expect(queryKey).toEqual({ tenant: 't1', locale: 'vi' });
    expect(extra).toEqual({ total: true });
  });

  test('noLimit lifts the limit and the skip', () => {
    const { filter } = ListFilterBuilder.build({
      params: {
        pagination: { page: 2, perPage: 5 },
        sort: { field: 'id', order: 'ASC' },
        filter: { noLimit: true },
      },
    });

    expect(filter.limit).toBeUndefined();
    expect(filter.skip).toBeUndefined();
    expect(filter.noLimit).toBeUndefined();
  });

  test('no perPage sends no limit, a page below 1 reads as page 1, and 0 and false stay filters', () => {
    const none = ListFilterBuilder.build({
      params: {
        pagination: { page: 4, perPage: 0 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      },
    });
    expect(none.filter.limit).toBeUndefined();
    expect(none.filter.skip).toBeUndefined();

    const first = ListFilterBuilder.build({
      params: {
        pagination: { page: -2, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      },
    });
    expect(first.filter.skip).toBe(0);

    const flags = ListFilterBuilder.build({
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
        active: false,
        stock: 0,
        gone: null,
      },
    });
    expect(flags.filter.active).toBe(false);
    expect(flags.filter.stock).toBe(0);
    expect('gone' in flags.filter).toBe(false);
  });
});
