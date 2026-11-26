import { describe, expect, test } from 'bun:test';

import { FetchSchemaError } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';

import { type IResponseSchema, RequestCountData, RequestTypes } from '@/common';
import { NetworkResponseReader } from '@/utilities';

const SECRET = 'a-token-from-the-body';

const json = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
};

const asNumber: IResponseSchema<number> = {
  parse: (data) => {
    if (typeof data !== 'number') {
      // What a careless schema does: quotes the value it refused.
      throw Object.assign(new Error(`not a number: ${JSON.stringify(data)}`), {
        issues: [{ path: ['total', 0], code: 'invalid_type', input: data }],
      });
    }

    return data;
  },
};

const refusalOf = async (task: Promise<unknown>) => {
  try {
    await task;
  } catch (error) {
    return error;
  }

  return undefined;
};

describe('NetworkResponseReader.read with a schema', () => {
  test('answers the data the schema checked, typed by it', async () => {
    const result = await NetworkResponseReader.read({
      response: json(7),
      type: RequestTypes.GET_ONE,
      schema: asNumber,
    });
    const typed: number = result.data;

    expect(typed).toBe(7);
  });

  test('refuses with a 502 FetchSchemaError that names paths and rules, never the data', async () => {
    const refusal = await refusalOf(
      NetworkResponseReader.read({
        response: json({ token: SECRET }),
        type: RequestTypes.GET_ONE,
        schema: asNumber,
      }),
    );

    expect(FetchSchemaError.is(refusal)).toBe(true);
    expect(refusal).toMatchObject({
      statusCode: 502,
      status: 200,
      issues: [{ path: ['total', 0], code: 'invalid_type' }],
    });
    expect(String(refusal)).not.toContain(SECRET);
    expect(JSON.stringify(refusal)).not.toContain(SECRET);
    expect(Reflect.get(Object(refusal), 'cause')).toBeUndefined();
  });

  test('keeps the query of the url out of the refusal', () => {
    const refusal = (() => {
      try {
        NetworkResponseReader.checkData({
          response: { data: 'x' },
          schema: asNumber,
          url: 'https://api.test/items?key=hidden',
        });
      } catch (error) {
        return error;
      }

      return undefined;
    })();

    expect(refusal).toMatchObject({ url: 'https://api.test/items' });
  });

  test('names one custom issue at the root for a schema that throws no issues', () => {
    const bare: IResponseSchema = {
      parse: () => {
        throw getError({ message: SECRET });
      },
    };

    expect(() => {
      return NetworkResponseReader.checkData({ response: { data: 1 }, schema: bare });
    }).toThrow(expect.objectContaining({ issues: [{ path: [], code: 'custom' }] }));
  });

  test('names a symbol of a path by its text', () => {
    const symbolic: IResponseSchema = {
      parse: () => {
        throw Object.assign(getError({ message: 'refused' }), {
          issues: [{ path: [Symbol('key'), 2], code: 'invalid_type' }],
        });
      },
    };

    expect(() => {
      return NetworkResponseReader.checkData({ response: { data: 1 }, schema: symbolic });
    }).toThrow(
      expect.objectContaining({ issues: [{ path: ['Symbol(key)', 2], code: 'invalid_type' }] }),
    );
  });

  test('refuses a 204 as no JSON, without calling the schema', async () => {
    let calls = 0;
    const accepting: IResponseSchema = {
      parse: (data) => {
        calls += 1;

        return data;
      },
    };

    const refusal = await refusalOf(
      NetworkResponseReader.read({
        response: new Response(null, { status: 204 }),
        type: RequestTypes.DELETE,
        schema: accepting,
      }),
    );

    expect(FetchSchemaError.is(refusal)).toBe(true);
    expect(refusal).toMatchObject({
      statusCode: 502,
      status: 204,
      issues: [{ path: [], code: 'invalid_json' }],
    });
    expect(calls).toBe(0);
  });

  test('answers an empty object for a 204 with no schema', async () => {
    const result = await NetworkResponseReader.read({
      response: new Response(null, { status: 204 }),
      type: RequestTypes.DELETE,
    });

    expect(result).toEqual({ data: {} });
  });

  test('gives the schema the rows of a list', async () => {
    const seen: unknown[] = [];
    const record: IResponseSchema<unknown> = {
      parse: (data) => {
        seen.push(data);

        return data;
      },
    };

    await NetworkResponseReader.read({
      response: json({ id: 1 }),
      type: RequestTypes.GET_LIST,
      schema: record,
    });

    expect(seen).toEqual([[{ id: 1 }]]);
  });

  test('a schema type argument cannot be written without a schema', () => {
    const unchecked = () => {
      const opts = { response: json(1), type: RequestTypes.GET_ONE };

      // @ts-expect-error - a type argument needs the schema that checks it
      return NetworkResponseReader.read<number>(opts);
    };

    expect(unchecked).toBeFunction();
  });
});

describe('NetworkResponseReader.convert, a count in the body of a request that is no list', () => {
  const convert = (data: unknown) => {
    return NetworkResponseReader.convert({
      response: { data, headers: new Headers() },
      type: RequestTypes.GET_ONE,
      requestCountData: RequestCountData.DATA_WITH_COUNT,
    });
  };

  test('answers data, count and total, and no other key of the body', () => {
    expect(convert({ data: { id: 1 }, count: 3, total: 9, filename: 7 })).toStrictEqual({
      data: { id: 1 },
      count: 3,
      total: 9,
    });
  });

  test('answers no count and no total that is no number', () => {
    const answered = convert({ data: 'x', count: '3', total: 'y' });

    expect(answered.count).toBeUndefined();
    expect(answered.total).toBeUndefined();
  });

  test('answers no data for a body that is no plain object', () => {
    for (const body of [null, 'text', 4, [1, 2]]) {
      expect(convert(body)).toEqual({ data: undefined });
    }
  });
});
