// A stand-in for the IGNIS API the shell talks to: sign-in for two users, and the two resources with the
// list contract ARDOR's data provider reads (JSON rows + `content-range: records a-b/total`).
import { Roles } from '../src/constants/shell';

type TRow = Record<string, string | number>;

class StubApi {
  static readonly PORT = 3100;
  static readonly SIGN_IN = '/api/auth/sign-in';
  static readonly RESOURCE = /^\/api\/(orders|products)(?:\/(\d+))?$/;
}

const USERS = [
  { userId: 1, username: 'admin', password: 'admin', roles: [Roles.ADMIN] },
  { userId: 2, username: 'viewer', password: 'viewer', roles: [Roles.VIEWER] },
];

const ROWS: Record<string, Array<TRow>> = {
  orders: Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    reference: `SO-${String(index + 1).padStart(4, '0')}`,
    status: index % 3 === 0 ? 'shipped' : 'open',
    total: 120 + index * 35,
  })),
  products: Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    name: `Product ${index + 1}`,
    price: 1000 + index * 250,
  })),
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, init);

const failure = (opts: { status: number; message: string }) => {
  return json(
    { error: { message: opts.message, statusCode: opts.status } },
    { status: opts.status },
  );
};

// IGNIS's sign-in body: `{ identifier: { scheme, value }, credential: { scheme, value } }`.
const signIn = async (request: Request) => {
  const body: unknown = await request.json();
  const identifier =
    isRecord(body) && isRecord(body.identifier) ? body.identifier.value : undefined;
  const credential =
    isRecord(body) && isRecord(body.credential) ? body.credential.value : undefined;
  const user = USERS.find((row) => row.username === identifier && row.password === credential);

  if (!user) {
    return failure({ status: 401, message: 'Invalid credentials' });
  }

  const token = { value: `${user.username}-token`, type: 'Bearer' };

  return json({ userId: user.userId, roles: user.roles, token });
};

// The filter arrives as one JSON parameter; this stub reads `skip`, `limit` and equality in `where`.
const list = (opts: { rows: Array<TRow>; filter: string | null }) => {
  const parsed: unknown = JSON.parse(opts.filter ?? '{}');
  const filter = isRecord(parsed) ? parsed : {};
  const where = isRecord(filter.where) ? filter.where : {};
  const matching = opts.rows.filter((row) => {
    return Object.entries(where).every(([field, value]) => row[field] === value);
  });
  const skip = typeof filter.skip === 'number' ? filter.skip : 0;
  const limit = typeof filter.limit === 'number' ? filter.limit : matching.length;
  const rows = matching.slice(skip, skip + limit);
  const range = rows.length
    ? `records ${skip}-${skip + rows.length - 1}/${matching.length}`
    : `records */${matching.length}`;

  return json(rows, { headers: { 'content-range': range } });
};

Bun.serve({
  port: StubApi.PORT,
  fetch: (request) => {
    const url = new URL(request.url);

    if (url.pathname === StubApi.SIGN_IN && request.method === 'POST') {
      return signIn(request);
    }

    const user = USERS.find((candidate) => {
      return request.headers.get('authorization') === `Bearer ${candidate.username}-token`;
    });

    if (!user) {
      return failure({ status: 401, message: 'Unauthorized' });
    }

    const match = url.pathname.match(StubApi.RESOURCE);
    const rows = match?.[1] ? ROWS[match[1]] : undefined;

    if (!rows || request.method !== 'GET') {
      return failure({ status: 404, message: 'Not found' });
    }

    if (match?.[2] === undefined) {
      return list({ rows, filter: url.searchParams.get('filter') });
    }

    // The backend checks every request: a viewer may list, never open one row.
    if (!user.roles.includes(Roles.ADMIN)) {
      return failure({ status: 403, message: 'Forbidden' });
    }

    const row = rows.find((candidate) => candidate.id === Number(match[2]));

    return row ? json(row) : failure({ status: 404, message: 'Not found' });
  },
});
