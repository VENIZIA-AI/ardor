// A stand-in for the IGNIS API the quickstart talks to: one sign-in endpoint and one resource with
// the list contract ARDOR's data provider reads (JSON rows + `content-range: records a-b/total`).
import 'reflect-metadata';

const PRODUCTS = Array.from({ length: 27 }, (_, index) => ({
  id: index + 1,
  name: `Product ${String(index + 1).padStart(2, '0')}`,
  price: 1000 + index * 250,
}));

const TOKEN = 'quickstart-token';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

const server = Bun.serve({
  port: 3100,
  fetch: async (request) => {
    const url = new URL(request.url);

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const body = (await request.json()) as { username?: string; password?: string };
      if (body.username !== 'admin' || body.password !== 'admin') {
        return json(
          { error: { message: 'Invalid credentials', statusCode: 401 } },
          { status: 401 },
        );
      }
      return json({ userId: 1, username: 'admin', token: { value: TOKEN, type: 'Bearer' } });
    }

    if (request.headers.get('authorization') !== `Bearer ${TOKEN}`) {
      return json({ error: { message: 'Unauthorized', statusCode: 401 } }, { status: 401 });
    }

    if (url.pathname === '/api/products' && request.method === 'GET') {
      const filter = JSON.parse(url.searchParams.get('filter') ?? '{}') as {
        limit?: number;
        skip?: number;
      };
      const skip = filter.skip ?? 0;
      const limit = filter.limit ?? PRODUCTS.length;
      const rows = PRODUCTS.slice(skip, skip + limit);
      return json(rows, {
        headers: {
          'content-range': `records ${skip}-${skip + rows.length - 1}/${PRODUCTS.length}`,
        },
      });
    }

    const single = url.pathname.match(/^\/api\/products\/(\d+)$/);
    if (single && request.method === 'GET') {
      const product = PRODUCTS.find((row) => row.id === Number(single[1]));
      return product
        ? json(product)
        : json({ error: { message: 'Not found', statusCode: 404 } }, { status: 404 });
    }

    return json({ error: { message: 'Not found', statusCode: 404 } }, { status: 404 });
  },
});

console.log(`[api] listening on http://127.0.0.1:${server.port}/api - sign in with admin / admin`);
