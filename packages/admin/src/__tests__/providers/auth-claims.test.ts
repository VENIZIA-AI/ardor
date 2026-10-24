import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { Logger } from '@venizia/ardor-kernel';

import { DefaultAuthProvider } from '@/providers/auth';

interface IClaimsReader {
  logger: Logger;
  decodeJwtClaims(opts: { jwt: string }): Record<string, unknown> | undefined;
}

const scope = 'auth-claims-test';

/** The provider without its container: `decodeJwtClaims` reads nothing but its input and its logger. */
const createReader = (): IClaimsReader => {
  const reader = Object.create(DefaultAuthProvider.prototype) as IClaimsReader;
  reader.logger = Logger.getInstance({ scope, enableDebug: true });

  return reader;
};

const encode = (value: string): string => btoa(value).replace(/=+$/, '');

afterEach(() => {
  Logger.getInstance({ scope, enableDebug: false });
});

const logsOf = (run: () => unknown): string => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method =>
    spyOn(console, method).mockImplementation(() => undefined),
  );

  try {
    run();

    return JSON.stringify(spies.flatMap(spy => spy.mock.calls));
  } finally {
    for (const spy of spies) {
      spy.mockRestore();
    }
  }
};

describe('DefaultAuthProvider.decodeJwtClaims', () => {
  test('reads the claims of a JWT', () => {
    const jwt = `header.${encode(JSON.stringify({ sub: 'u1', roles: ['admin'] }))}.signature`;

    expect(createReader().decodeJwtClaims({ jwt })).toEqual({ sub: 'u1', roles: ['admin'] });
  });

  test('a payload that is not base64 gives no claims and the failure is logged by name', () => {
    let claims: unknown = 'unset';

    const logged = logsOf(() => {
      claims = createReader().decodeJwtClaims({ jwt: 'header.@@@@.signature' });
    });

    expect(claims).toBeUndefined();
    expect(logged).toContain('decodeJwtClaims');
    expect(logged).toContain('InvalidCharacterError');
  });

  test('a payload that is not JSON gives no claims, and the log never quotes the payload', () => {
    let claims: unknown = 'unset';

    const logged = logsOf(() => {
      claims = createReader().decodeJwtClaims({ jwt: `header.${encode('secretclaims')}.sig` });
    });

    expect(claims).toBeUndefined();
    expect(logged).toContain('decodeJwtClaims');
    expect(logged).not.toContain('secretclaims');
    expect(logged).not.toContain(encode('secretclaims'));
  });
});
