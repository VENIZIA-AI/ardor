import { describe, expect, spyOn, test } from 'bun:test';

import { FetchSchemaError, LoggerFactory } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';

import { type IResponseSchema, RequestCountData, RequestTypes, type TRequestType } from '@/common';
import { NetworkResponseReader } from '@/utilities';

const SECRET = 'a-token-from-the-body';

/** A JSON answer; `text` replaces the encoded body. */
const json = (body: unknown, status = 200, text = JSON.stringify(body)) => {
  return new Response(text, {
    status,
    headers: { 'content-type': 'application/json' },
  });
};

const asNumber: IResponseSchema<number> = {
  parse: (data) => {
    if (typeof data !== 'number') {
      // What a careless schema does: quotes the value it refused.
      throw Object.assign(getError({ message: `not a number: ${JSON.stringify(data)}` }), {
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

  test('refuses an empty body as no JSON, a list included, without calling the schema', async () => {
    let calls = 0;
    const accepting: IResponseSchema = {
      parse: (data) => {
        calls += 1;

        return data;
      },
    };
    const cases: Array<{ response: Response; type: TRequestType }> = [
      { response: new Response(''), type: RequestTypes.GET_LIST },
      { response: json(null, 200, ''), type: RequestTypes.GET_ONE },
      { response: new Response(null, { status: 200 }), type: RequestTypes.GET_ONE },
    ];

    for (const { response, type } of cases) {
      const refusal = await refusalOf(
        NetworkResponseReader.read({ response, type, schema: accepting }),
      );

      expect(refusal).toMatchObject({
        status: 200,
        issues: [{ path: [], code: 'invalid_json' }],
      });
    }

    expect(calls).toBe(0);
  });

  test.each([
    ['broken JSON', '{"id":', 'application/json'],
    ['whitespace', '   ', 'application/json'],
    ['plain text', 'done', 'text/plain'],
    ['csv', 'a,b', 'text/csv'],
  ])('refuses %s as no JSON, without calling the schema', async (_name, text, contentType) => {
    let calls = 0;
    const accepting: IResponseSchema = {
      parse: (data) => {
        calls += 1;

        return data;
      },
    };
    const refusal = await refusalOf(
      NetworkResponseReader.read({
        response: new Response(text, { headers: { 'content-type': contentType } }),
        type: RequestTypes.GET_ONE,
        schema: accepting,
      }),
    );

    expect(FetchSchemaError.is(refusal)).toBe(true);
    expect(refusal).toMatchObject({ status: 200, issues: [{ path: [], code: 'invalid_json' }] });
    expect(String(refusal)).not.toContain(text.trim() || '{');
    expect(calls).toBe(0);
  });

  test('gives the schema the value of a JSON body sent as plain text', async () => {
    const result = await NetworkResponseReader.read({
      response: new Response('7', { headers: { 'content-type': 'text/plain' } }),
      type: RequestTypes.GET_ONE,
      schema: asNumber,
    });

    expect(result.data).toBe(7);
  });

  test('answers plain text and broken JSON as before with no schema', async () => {
    const plain = await NetworkResponseReader.read({
      response: new Response('done', { headers: { 'content-type': 'text/plain' } }),
      type: RequestTypes.GET_ONE,
    });
    const broken = await refusalOf(
      NetworkResponseReader.read({
        response: new Response('{', { headers: { 'content-type': 'application/json' } }),
        type: RequestTypes.GET_ONE,
      }),
    );

    expect(plain.data).toBe('done');
    expect(broken).toMatchObject({ statusCode: 502 });
    expect(FetchSchemaError.is(broken)).toBe(false);
  });

  test('gives the schema the null of a JSON body that says null', async () => {
    const result = await NetworkResponseReader.read({
      response: json(null),
      type: RequestTypes.GET_ONE,
      schema: { parse: (data) => data },
    });

    expect(result.data).toBeNull();
  });

  test('gives the schema the Blob of an empty file', async () => {
    const result = await NetworkResponseReader.read({
      response: new Response('', { headers: { 'content-disposition': 'attachment' } }),
      type: RequestTypes.GET_ONE,
      schema: { parse: (data) => data instanceof Blob },
    });

    expect(result.data).toBe(true);
  });

  test('gives the schema the Blob of an empty body of a file type', async () => {
    const result = await NetworkResponseReader.read({
      response: new Response('', { headers: { 'content-type': 'application/octet-stream' } }),
      type: RequestTypes.GET_ONE,
      schema: { parse: (data) => data instanceof Blob },
    });

    expect(result.data).toBe(true);
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

describe('NetworkResponseReader.convert, the count in the body of a list', () => {
  const countOf = (count: unknown) => {
    const warn = spyOn(
      LoggerFactory.getLogger([NetworkResponseReader.name]),
      'warn',
    ).mockImplementation(() => undefined);
    const answered = NetworkResponseReader.convert({
      response: { data: { data: [{ id: 1 }, { id: 2 }], count }, headers: new Headers() },
      type: RequestTypes.GET_LIST,
      requestCountData: RequestCountData.DATA_WITH_COUNT,
    });
    const warnings = warn.mock.calls.length;

    warn.mockRestore();

    return { count: answered.count, warnings };
  };

  test.each([
    [9, 9],
    [0, 0],
    ['12', 12],
  ])('reads the count %p', (sent, count) => {
    expect(countOf(sent)).toEqual({ count, warnings: 0 });
  });

  test.each([null, undefined])('counts the rows for a count of %p', (sent) => {
    expect(countOf(sent)).toEqual({ count: 2, warnings: 0 });
  });

  test.each([-1, 2.5, '-1', '2.5', '0x10', '1e3', ' 5', '', {}])(
    'answers 0 and warns for the count %p',
    (sent) => {
      expect(countOf(sent)).toEqual({ count: 0, warnings: 1 });
    },
  );
});
