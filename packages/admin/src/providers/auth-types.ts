import type { TStringConstValue } from '@venizia/ardor-kernel';

/** What the login form hands to `login`: the user name and the password, and whatever else the form holds. */
export interface ILoginParams {
  username?: string;
  password?: string;
  [field: string]: unknown;
}

/**
 * Why `onSessionCleared` was called.
 */
export class SessionClearReasons {
  /** `logout` ran. */
  static readonly LOGOUT = 'logout';
  /** `checkError` met a 401. */
  static readonly UNAUTHORIZED = 'unauthorized';
  /** The session was cleared by code that is not this provider, such as the network service's `onAuthFailure`. */
  static readonly EXTERNAL = 'external';
  /** `checkAuth` rejected: no token is stored, or the server answered with no data. */
  static readonly REJECTED = 'rejected';
}

/** One of the `SessionClearReasons` values. */
export type TSessionClearReason = TStringConstValue<typeof SessionClearReasons>;
