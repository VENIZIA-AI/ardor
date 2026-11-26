import { RecordUtility } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';

import { App, type ISignInSession } from '@venizia/ardor-kernel';

/** Reads what a sign-in answers. `DefaultAuthProvider` calls it from the hooks of the same names. */
export class SignInUtility {
  /** The session of a sign-in answer; throws without a token or a user id. */
  static readSession(opts: {
    data: unknown;
    decodeClaims: (params: { jwt: string }) => Record<string, unknown> | undefined;
    readRoleNames: (params: { roles: unknown }) => Array<string>;
  }): ISignInSession {
    const body: Record<string, unknown> = RecordUtility.isRecord(opts.data) ? opts.data : {};
    const { userId, token, roles } = body;
    const sent = RecordUtility.isRecord(token) ? token : undefined;

    const record: Record<string, unknown> | undefined =
      typeof token === 'string' ? { value: token, type: App.TOKEN_TYPE } : sent;

    if (typeof record?.value !== 'string' || record.value.length === 0) {
      throw getError({
        message:
          '[login] The sign-in response carries no token | Expect { userId, token: { value, type } } or { token: <jwt> }',
      });
    }

    const claims = opts.decodeClaims({ jwt: record.value });

    const isUserId = (value: unknown): value is number | string => {
      return typeof value === 'number' || (typeof value === 'string' && value.length > 0);
    };

    const resolvedUserId = [userId, claims?.userId, claims?.sub].find(isUserId);

    if (resolvedUserId === undefined) {
      throw getError({
        message:
          '[login] The sign-in response carries no user id | Send userId next to the token, or put a userId or sub claim in the JWT',
      });
    }

    return {
      userId: resolvedUserId,
      token: {
        value: record.value,
        type: typeof record.type === 'string' ? record.type : App.TOKEN_TYPE,
      },
      roles: opts.readRoleNames({ roles: roles ?? claims?.roles }),
    };
  }

  /** The claims of a JWT, or `undefined` for a token that is not one. The signature is not checked. */
  static decodeClaims(opts: {
    jwt: string;
    logger: { debug(message: string, ...args: unknown[]): void };
  }): Record<string, unknown> | undefined {
    const segment = opts.jwt.split('.')[1];

    if (!segment) {
      return undefined;
    }

    try {
      const bytes = Uint8Array.from(atob(segment.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
        char.charCodeAt(0),
      );
      const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));

      return RecordUtility.isRecord(claims) ? claims : undefined;
    } catch (error) {
      // The name only: the message of a JSON parse error quotes the payload it could not parse.
      opts.logger.debug(
        '[decodeJwtClaims] The token payload cannot be decoded, reading no claims | error: %s',
        error instanceof Error ? error.name : typeof error,
      );

      return undefined;
    }
  }

  /** The role names of a list: a string, or an object's `identifier`, else its `name`. */
  static readRoleNames(opts: { roles: unknown }): Array<string> {
    if (!Array.isArray(opts.roles)) {
      return [];
    }

    const names: Array<string> = [];

    const roles: unknown[] = opts.roles;

    for (const role of roles) {
      const named: Record<string, unknown> = RecordUtility.isRecord(role) ? role : {};
      const name =
        typeof role === 'string'
          ? role
          : [named.identifier, named.name].find((v) => typeof v === 'string');

      if (typeof name === 'string' && name.length > 0) {
        names.push(name);
      }
    }

    return names;
  }
}
