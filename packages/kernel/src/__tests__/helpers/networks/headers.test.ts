import { describe, expect, test } from 'bun:test';

import { NetworkHeaders } from '@/helpers/networks/headers';

describe('NetworkHeaders.toRecord', () => {
  test('is an empty record for no headers', () => {
    expect(NetworkHeaders.toRecord({})).toEqual({});
    expect(NetworkHeaders.toRecord({ headers: undefined })).toEqual({});
  });

  test('reads a Headers instance, a tuple list and a record, lowercasing every name', () => {
    expect(NetworkHeaders.toRecord({ headers: new Headers({ 'X-One': '1' }) })).toEqual({
      'x-one': '1',
    });
    expect(NetworkHeaders.toRecord({ headers: [['X-Two', '2']] })).toEqual({ 'x-two': '2' });
    expect(
      NetworkHeaders.toRecord({ headers: { 'X-Three': '3', 'CONTENT-TYPE': 'text/plain' } }),
    ).toEqual({
      'x-three': '3',
      'content-type': 'text/plain',
    });
  });

  test('writes a number value as text', () => {
    expect(NetworkHeaders.toRecord({ headers: { 'X-Page': 2 } })).toEqual({ 'x-page': '2' });
  });
});

describe('NetworkHeaders.merge', () => {
  test('a later source replaces an earlier one, whatever case either used', () => {
    const merged = NetworkHeaders.merge({
      sources: [
        { 'Content-Type': 'application/json', 'X-A': '1' },
        undefined,
        { 'content-type': 'text/plain' },
      ],
    });

    expect(merged).toEqual({ 'content-type': 'text/plain', 'x-a': '1' });
  });

  test('is an empty record for no sources', () => {
    expect(NetworkHeaders.merge({ sources: [] })).toEqual({});
  });
});
