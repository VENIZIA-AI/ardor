import { ConstClass } from '@venizia/ignis-helpers/common';

/**
 * Values of the running environment, read once when the module loads.
 */
export class App {
  /** The IANA name of the timezone of the runtime. */
  static readonly TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
  /** The offset from UTC in hours, positive east of UTC (the opposite sign of `getTimezoneOffset()`). */
  static readonly TIMEZONE_OFFSET = -(new Date().getTimezoneOffset() / 60);
  /** In milliseconds. */
  static readonly DEFAULT_DEBOUNCE_TIME = 500;
  /** The authorization scheme of a token that names none. */
  static readonly TOKEN_TYPE = 'Bearer';
}

/**
 * HTTP methods.
 */
export class RequestMethods extends ConstClass {
  static readonly HEAD = 'HEAD';
  static readonly OPTIONS = 'OPTIONS';
  static readonly GET = 'GET';
  static readonly POST = 'POST';
  static readonly PUT = 'PUT';
  static readonly PATCH = 'PATCH';
  static readonly DELETE = 'DELETE';
}

/**
 * What a request is for, which decides how its response is read: `SEND`, and react-admin's data provider calls.
 */
export class RequestTypes extends ConstClass {
  /** A request that is not a react-admin call. */
  static readonly SEND = 'SEND';

  // react-admin
  static readonly GET_LIST = 'GET_LIST';
  static readonly GET_ONE = 'GET_ONE';
  static readonly GET_MANY = 'GET_MANY';
  static readonly GET_MANY_REFERENCE = 'GET_MANY_REFERENCE';
  static readonly CREATE = 'CREATE';
  static readonly UPDATE = 'UPDATE';
  static readonly UPDATE_MANY = 'UPDATE_MANY';
  static readonly DELETE = 'DELETE';
  static readonly DELETE_MANY = 'DELETE_MANY';
}

/**
 * The Web Storage areas `BrowserStorage` reads and writes.
 */
export class StorageAreas {
  /** `localStorage`. */
  static readonly LOCAL = 'local';
  /** `sessionStorage`. */
  static readonly SESSION = 'session';
}

/**
 * How a request body is encoded; see `RequestBodyEncoder`.
 */
export class RequestBodyTypes extends ConstClass {
  /** The body goes through as it is. */
  static readonly NONE = 'none';
  static readonly FORM_DATA = 'form-data';
  static readonly FORM_URL_ENCODED = 'x-www-form-urlencoded';
  static readonly JSON = 'json';
  static readonly BINARY = 'binary';
}

/**
 * Names of the build environments.
 */
export class Environments extends ConstClass {
  static readonly DEVELOPMENT = 'development';
  static readonly PRODUCTION = 'production';
}

/**
 * The channels a request says it comes from, sent in `x-request-channel`.
 */
export class RequestChannel extends ConstClass {
  /** A browser application; what a request says unless `requestTracingChannel` is set. */
  static readonly WEB = '100_WEB';
}

/**
 * Whether a response carries a count, sent in `x-request-count`.
 */
export class RequestCountData extends ConstClass {
  /**
   * @description Only the data is returned in the response body
   */
  static readonly DATA_ONLY = '0';

  /**
   * @description Both data and count are returned in the response body
   */
  static readonly DATA_WITH_COUNT = '1';
}
