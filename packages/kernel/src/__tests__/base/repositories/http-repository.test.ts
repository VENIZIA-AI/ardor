import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { HttpDataSource, HttpRepository } from '@/base/repositories';
import { readAuthTokenFromStorage } from '@/base/services/network-request';
import { LocalStorageKeys } from '@/common';

/**
 * ARDOR's contract with the HTTP repository it re-exports from `@venizia/ignis-connectors/http`.
 *
 * The implementation is IGNIS's; these are the behaviours ARDOR screens depend on, each one a case
 * that was once wrong somewhere. A bump that breaks one fails here, in ARDOR, rather than as a list
 * quietly showing the wrong rows.
 */

interface ITicket {
  id: string;
  title: string;
}

type THandler = (req: Request) => Response;

const serve = (opts: { handler: THandler }) => {
  return Bun.serve({ port: 0, fetch: opts.handler });
};

const repositoryFor = (opts: {
  server: ReturnType<typeof Bun.serve>;
  settings?: Partial<ConstructorParameters<typeof HttpDataSource>[0]>;
  countPath?: string;
}) => {
  return new HttpRepository<ITicket>({
    dataSource: new HttpDataSource({
      baseUrl: `http://127.0.0.1:${opts.server.port}`,
      ...opts.settings,
    }),
    resource: 'tickets',
    countPath: opts.countPath,
  });
};

describe('the re-exported HTTP repository', () => {
  let server: ReturnType<typeof Bun.serve>;
  let tickets: HttpRepository<ITicket>;
  const seen: Array<{ pathname: string; search: string; requestCount: string | null }> = [];

  beforeAll(() => {
    server = serve({
      handler: (req: Request): Response => {
        const url = new URL(req.url);
        seen.push({
          pathname: url.pathname,
          search: url.search,
          requestCount: req.headers.get('x-request-count'),
        });

        if (url.pathname === '/tickets/count') {
          return Response.json({ count: 2 });
        }

        if (url.pathname === '/tickets/t-1') {
          return Response.json({ id: 't-1', title: 'First' });
        }

        return Response.json([{ id: 't-1', title: 'First' }], {
          headers: { 'content-range': 'records 0-0/7' },
        });
      },
    });

    tickets = repositoryFor({ server });
  });

  afterAll(async () => {
    await server.stop(true);
  });

  test('find sends the ignis-filter vocabulary and asks for a bare array', async () => {
    seen.length = 0;
    await tickets.find({ filter: { where: { title: 'First' }, limit: 10 } });

    expect(seen[0].pathname).toBe('/tickets');
    expect(decodeURIComponent(seen[0].search)).toContain('"title":"First"');
    expect(seen[0].requestCount).toBe('false');
  });

  // The stub reports 7 in `Content-Range` while returning 1 row, so a total derived from the page
  // length reads 1 and fails.
  test('the range total comes from content-range, not from the page', async () => {
    const rs = await tickets.find({ filter: { limit: 1 }, options: { shouldQueryRange: true } });

    expect(rs.data.length).toBe(1);
    expect(rs.range.total).toBe(7);
    expect(rs.range.start).toBe(0);
  });

  test('findById reaches the resource path with the id appended', async () => {
    seen.length = 0;
    const found = await tickets.findById({ id: 't-1' });

    expect(seen[0].pathname).toBe('/tickets/t-1');
    expect(found?.title).toBe('First');
  });

  test('findOne asks for one row and unwraps it', async () => {
    seen.length = 0;
    const one = await tickets.findOne({ filter: { where: {} } });

    expect(decodeURIComponent(seen[0].search)).toContain('"limit":1');
    expect(one?.id).toBe('t-1');
  });

  test('count reads the total from the list range by default', async () => {
    seen.length = 0;

    expect(await tickets.count({ where: {} })).toEqual({ count: 7 });
    expect(seen[0].pathname).toBe('/tickets');
  });

  test('count uses a dedicated route only when one is named', async () => {
    const counted = repositoryFor({ server, countPath: 'count' });
    seen.length = 0;

    expect(await counted.count({ where: {} })).toEqual({ count: 2 });
    expect(seen[0].pathname).toBe('/tickets/count');
  });

  test('the datasource reports no transactions rather than pretending', () => {
    expect(tickets.dataSource.getCapabilities()).toEqual({ transactions: false });
    expect(tickets.getEntity().name).toBe('tickets');
  });

  /**
   * An IGNIS route sends `Content-Range` only where it passes a range, so a hand-written route can
   * omit it. With no header there is no total, and answering with the page size would report 1 for
   * a table of any size. Existence needs no total, so that question still gets an answer.
   */
  test('count refuses without content-range, while existsWith still answers', async () => {
    const bare = serve({ handler: () => Response.json([{ id: 't-1', title: 'First' }]) });

    try {
      const repository = repositoryFor({ server: bare });

      await expect(repository.count({ where: {} })).rejects.toThrow(/no Content-Range/);
      expect(await repository.existsWith({ where: {} })).toBe(true);
    } finally {
      await bare.stop(true);
    }
  });

  /**
   * IGNIS's `x-request-count` defaults ON, so a route that skips `normalizeCountData` can answer the
   * `{ count, data }` envelope even when asked for an array. Read as a row, fifty results render as
   * one with no error anywhere - measured in ARDOR's own transport before this contract existed.
   */
  test('a list read opens the count envelope instead of returning it as one row', async () => {
    const enveloped = serve({
      handler: () => Response.json({ count: 3, data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }),
    });

    try {
      const rows = await repositoryFor({ server: enveloped }).find({ filter: {} });

      expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    } finally {
      await enveloped.stop(true);
    }
  });

  /**
   * Server-to-server, made falsifiable. Bun has no `localStorage`, but this suite's preload
   * (`__tests__/setup.ts`) installs one - so it is deleted for the duration, and the deletion is
   * asserted rather than assumed: a delete that silently failed would leave the token reachable and
   * the test green for the wrong reason.
   */
  test('authenticates from an injected resolver with no localStorage in the process', async () => {
    const received: { authorization: string | null } = { authorization: null };
    const echo = serve({
      handler: (req: Request) => {
        received.authorization = req.headers.get('authorization');
        return Response.json([]);
      },
    });
    const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(typeof localStorage).toBe('undefined');

    try {
      await repositoryFor({
        server: echo,
        settings: { authTokenResolver: () => ({ value: 'server-to-server' }) },
      }).find({ filter: {} });

      expect(received.authorization).toBe('Bearer server-to-server');
    } finally {
      if (storageDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
      }
      await echo.stop(true);
    }
  });

  /**
   * The browser half of the same seam. The connector ships no storage lookup, so an ARDOR app hands
   * it ARDOR's - and a repository then reads the same stored token the data provider does.
   */
  test("ARDOR's storage resolver feeds the connector the stored token and provider", async () => {
    const headers: { authorization: string | null; provider: string | null } = {
      authorization: null,
      provider: null,
    };
    const echo = serve({
      handler: (req: Request) => {
        headers.authorization = req.headers.get('authorization');
        headers.provider = req.headers.get('x-auth-provider');
        return Response.json([]);
      },
    });
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: 'stored-token', provider: 'oidc' }),
    );

    try {
      await repositoryFor({
        server: echo,
        settings: { authTokenResolver: readAuthTokenFromStorage },
      }).find({ filter: {} });

      expect(headers).toEqual({ authorization: 'Bearer stored-token', provider: 'oidc' });
    } finally {
      localStorage.removeItem(LocalStorageKeys.KEY_AUTH_TOKEN);
      await echo.stop(true);
    }
  });

  /**
   * Shapes outside the contract, refused rather than answered plausibly.
   *
   * Every case here was a silent wrong answer in a published connector, found from ARDOR and fixed
   * upstream in `0.2.0-42`. They are asserted here because ARDOR screens depend on the refusal: a
   * regression would come back as a list showing one row, or a count of 0 for a full table.
   */
  describe('shapes outside the contract', () => {
    // `toContentRange` (`@venizia/ignis-kernel`, `base/controllers/rest/base.ts`) writes
    // `records */` for an empty page. A parser needing digits on both sides of the dash read
    // that as NO header, so a filter matching nothing threw instead of answering 0.
    test('count on an empty page reads the total from records */N', async () => {
      const empty = serve({
        handler: () => Response.json([], { headers: { 'content-range': 'records */0' } }),
      });

      try {
        expect(await repositoryFor({ server: empty }).count({ where: {} })).toEqual({ count: 0 });
      } finally {
        await empty.stop(true);
      }
    });

    // The header decides whether rows come back bare or wrapped, so the datasource owns it. A
    // configured value silently changed how every response was read - `findById` handed back the
    // envelope instead of the record. It is refused where it is written now.
    test('configuring x-request-count is refused when the datasource is built', () => {
      expect(() => {
        return new HttpDataSource({
          baseUrl: 'http://127.0.0.1:1',
          headers: { 'X-Request-Count': 'true' },
        });
      }).toThrow(/x-request-count is owned/);
    });

    // Answering 0 for a count route that reported no number reads as an empty table.
    test('count refuses a count route that answers no number', async () => {
      const odd = serve({ handler: () => Response.json({ total: 42 }) });

      try {
        await expect(
          repositoryFor({ server: odd, countPath: 'count' }).count({ where: {} }),
        ).rejects.toThrow(/no numeric count/);
      } finally {
        await odd.stop(true);
      }
    });

    // A record holding `X-Tenant` and `x-tenant` used to arrive as `"north, south"` - the datasource
    // seeded its header set with `new Headers(input)`, and that constructor joins duplicates before
    // any `.set` can replace them. Names fold to lower case now and the last spelling wins.
    test('two spellings of one header name collapse to the last value', async () => {
      const received: { tenant: string | null } = { tenant: null };
      const echo = serve({
        handler: (req: Request) => {
          received.tenant = req.headers.get('x-tenant');
          return Response.json([]);
        },
      });

      try {
        await repositoryFor({
          server: echo,
          settings: { headers: { 'X-Tenant': 'north', 'x-tenant': 'south' } },
        }).find({ filter: {} });

        expect(received.tenant).toBe('south');
      } finally {
        await echo.stop(true);
      }
    });

    // A body that is neither an array nor `{ count, data }` used to count as one row, so
    // `existsWith` answered `true` for a result that held nothing.
    test('a list body outside the contract is refused rather than counted as one row', async () => {
      const odd = serve({ handler: () => Response.json({ data: [{ id: 'a' }], page: 1 }) });

      try {
        await expect(repositoryFor({ server: odd }).find({ filter: {} })).rejects.toThrow(
          /neither an array nor/,
        );
      } finally {
        await odd.stop(true);
      }
    });
  });
});
