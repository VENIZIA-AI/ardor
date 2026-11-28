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

  test('leaves react-admin abort signal out of the filter', () => {
    const { filter } = ListFilterBuilder.build({
      params: { filter: { status: 'open' }, signal: new AbortController().signal },
    });

    expect(Object.keys(filter)).not.toContain('signal');
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

  test.each([
    ['no page: page 1', { perPage: 10 }, { limit: 10, skip: 0 }],
    ['page 0: page 1', { page: 0, perPage: 10 }, { limit: 10, skip: 0 }],
    ['a negative page: page 1', { page: -3, perPage: 10 }, { limit: 10, skip: 0 }],
    ['page 3', { page: 3, perPage: 10 }, { limit: 10, skip: 20 }],
    ['perPage 0: no limit', { page: 2, perPage: 0 }, { limit: undefined, skip: undefined }],
    [
      'a negative perPage: no limit',
      { page: 2, perPage: -5 },
      { limit: undefined, skip: undefined },
    ],
    ['no pagination at all: no limit', undefined, { limit: undefined, skip: undefined }],
  ])('pagination %s', (_name, pagination, expected) => {
    const { filter } = ListFilterBuilder.build({
      params: {
        pagination: pagination as never,
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      },
    });

    expect(filter.limit).toBe(expected.limit);
    expect(filter.skip).toBe(expected.skip);
    expect(filter.offset).toBeUndefined();
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
    expect(flags.filter.where).toEqual({ active: false, stock: 0 });
  });
});

/** The filter as the request carries it: JSON drops an `undefined` value. */
const sent = (params: Parameters<typeof ListFilterBuilder.build>[0]['params']): unknown => {
  return JSON.parse(JSON.stringify(ListFilterBuilder.build({ params }).filter));
};

describe('ListFilterBuilder.build, the keys IGNIS takes', () => {
  test('moves a key beside where into where, and keeps the filter keys', () => {
    const filter = {
      where: { status: 'open' },
      include: [{ relation: 'author' }],
      fields: ['id'],
      order: ['id ASC'],
      limit: 5,
      offset: 10,
      q: 'rope',
      active: false,
      stock: 0,
    };

    expect(sent({ filter })).toEqual({
      where: { status: 'open', q: 'rope', active: false, stock: 0 },
      include: [{ relation: 'author' }],
      fields: ['id'],
      order: ['id ASC'],
      limit: 5,
      offset: 10,
    });
    expect(filter.where).toEqual({ status: 'open' });
  });

  test('moves an extra list param into where, and keeps one that is a filter key', () => {
    expect(
      sent({ filter: { status: 'open' }, tenantId: 't1', include: ['author'], skip: 3 }),
    ).toEqual({ where: { status: 'open', tenantId: 't1' }, include: ['author'], skip: 3 });
  });

  test.each([
    ['beside where', { filter: { where: { id: 1 }, id: 2 } }, { id: 1 }],
    ['as an extra list param', { filter: { where: { id: 1 } }, id: 2 }, { id: 1 }],
    ['as a flat filter key and a list param', { filter: { id: 1 }, id: 2 }, { id: 1 }],
  ])('a column named twice, %s: where wins', (_name, params, where) => {
    expect(sent(params)).toEqual({ where });
  });

  // A list param named like a filter key, or like a key beside `where`, replaces it.
  test.each([
    ['a key beside where', { filter: { where: {}, id: 1 }, id: 2 }, { where: { id: 2 } }],
    ['where itself', { filter: { where: { id: 1 } }, where: { id: 2 } }, { where: { id: 2 } }],
  ])('a list param wins over %s', (_name, params, expected) => {
    expect(sent(params)).toEqual(expected);
  });

  test.each([
    ['a flat filter', { filter: { noLimit: false } }],
    ['a filter with where', { filter: { where: {}, noLimit: false } }],
    ['an extra list param', { filter: {}, noLimit: true }],
  ])('never sends noLimit, from %s', (_name, params) => {
    expect(sent({ pagination: { page: 1, perPage: 10 }, ...params })).toEqual({
      where: {},
      limit: 10,
      skip: 0,
    });
  });

  test('keeps an extra list param named params going to the query', () => {
    const { filter, queryKey } = ListFilterBuilder.build({
      params: { filter: { where: {} }, params: { tenant: 't1' } },
    });

    expect(queryKey).toEqual({ tenant: 't1' });
    expect(JSON.parse(JSON.stringify(filter))).toEqual({ where: {} });
  });
});
