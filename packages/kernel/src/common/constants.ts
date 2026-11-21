/** Values of the running environment, read once when the module loads. */
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

/** HTTP methods. */
export class RequestMethods {
  static readonly HEAD = 'HEAD';
  static readonly OPTIONS = 'OPTIONS';
  static readonly GET = 'GET';
  static readonly POST = 'POST';
  static readonly PUT = 'PUT';
  static readonly PATCH = 'PATCH';
  static readonly DELETE = 'DELETE';

  /** Every value of this class that `isValid` accepts. */
  static readonly SCHEME_SET = new Set([
    this.HEAD,
    this.OPTIONS,
    this.GET,
    this.POST,
    this.PUT,
    this.PATCH,
    this.DELETE,
  ]);

  /** Whether `value` is in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

/** What a request is for, which decides how its response is read: `SEND`, and react-admin's data provider calls. */
export class RequestTypes {
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

  /** Every value of this class that `isValid` accepts. */
  static readonly SCHEME_SET = new Set([
    this.SEND,
    this.GET_ONE,
    this.GET_LIST,
    this.GET_MANY,
    this.GET_MANY_REFERENCE,
    this.CREATE,
    this.UPDATE,
    this.UPDATE_MANY,
    this.DELETE,
    this.DELETE_MANY,
  ]);

  /** Whether `value` is in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

/** The Web Storage areas `BrowserStorage` reads and writes. */
export class StorageAreas {
  /** `localStorage`. */
  static readonly LOCAL = 'local';
  /** `sessionStorage`. */
  static readonly SESSION = 'session';
}

/** How a request body is encoded; see `RequestBodyEncoder`. */
export class RequestBodyTypes {
  /** The body goes through as it is. */
  static readonly NONE = 'none';
  static readonly FORM_DATA = 'form-data';
  static readonly FORM_URL_ENCODED = 'x-www-form-urlencoded';
  static readonly JSON = 'json';
  static readonly BINARY = 'binary';

  /** Every value of this class that `isValid` accepts. */
  static readonly SCHEME_SET = new Set([
    this.NONE,
    this.FORM_DATA,
    this.FORM_URL_ENCODED,
    this.JSON,
    this.BINARY,
  ]);

  /** Whether `value` is in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

/** Names of the build environments. */
export class Environments {
  static readonly DEVELOPMENT = 'development';
  static readonly PRODUCTION = 'production';

  /** Every value of this class that `isValid` accepts. */
  static readonly SCHEME_SET = new Set([this.DEVELOPMENT, this.PRODUCTION]);

  /** Whether `value` is in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

/** The channels a request says it comes from, sent in `x-request-channel`. */
export class RequestChannel {
  /** A browser application; what a request says unless `requestTracingChannel` is set. */
  static readonly WEB = '100_WEB';

  /** Every value of this class that `isValid` accepts. */
  static readonly SCHEME_SET = new Set([this.WEB]);

  /** Whether `value` is in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

/** Whether a response carries a count, sent in `x-request-count`. */
export class RequestCountData {
  /**
   * @description Only the data is returned in the response body
   */
  static readonly DATA_ONLY = '0';

  /**
   * @description Both data and count are returned in the response body
   */
  static readonly DATA_WITH_COUNT = '1';

  /** Every value of this class that `isValid` accepts. */
  static readonly SCHEME_SET = new Set([this.DATA_ONLY, this.DATA_WITH_COUNT]);

  /** Whether `value` is in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}
