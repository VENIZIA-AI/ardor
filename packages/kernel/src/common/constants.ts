/** Values of the running environment, read once when the module loads. */
export class App {
  /** The IANA name of the timezone of the runtime. */
  static readonly TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
  /** The offset from UTC in hours, positive east of UTC (the opposite sign of `getTimezoneOffset()`). */
  static readonly TIMEZONE_OFFSET = -(new Date().getTimezoneOffset() / 60);
  /** In milliseconds. */
  static readonly DEFAULT_DEBOUNCE_TIME = 500;
}

/** Authorization schemes (`Basic`, `Bearer`) and strategies (`basic`, `jwt`). */
export class Authentication {
  /** The scheme in the `authorization` header. */
  static readonly TYPE_BASIC = 'Basic';
  static readonly TYPE_BEARER = 'Bearer';

  /** The name of the auth strategy. */
  static readonly STRATEGY_BASIC = 'basic';
  static readonly STRATEGY_JWT = 'jwt';

  /** Every value of this class that `isValid` accepts. */
  static readonly SCHEME_SET = new Set([
    this.TYPE_BASIC,
    this.TYPE_BEARER,
    this.STRATEGY_BASIC,
    this.STRATEGY_JWT,
  ]);

  /** Whether `value` is in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
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

/** Header names, lowercase, and patterns on header values. */
export class HeaderConstants {
  /** The header on a request body and on a response. */
  static readonly CONTENT_TYPE = 'content-type';

  /**
   * content-range: <unit> <range-start>-<range-end>/<size>
   * @format unit start-end/total
   * The positions are zero-indexed, the end inclusive; the total is `*` if unknown.
   */
  static readonly CONTENT_RANGE = 'content-range';
  /** Names the file of a file response. */
  static readonly CONTENT_DISPOSITION = 'content-disposition';

  /** Carries `<type> <token>`. */
  static readonly AUTHORIZATION = 'authorization';
  /** Names the provider of the token; sent only when the token names one. */
  static readonly X_AUTH_PROVIDER = 'x-auth-provider';
  /** The locale of the request, the header `useRequestHeaderLocale` sets by default. */
  static readonly X_LOCALE = 'x-locale';

  // Lowercase: the service keys its header record by lowercased name.
  /** Carries `App.TIMEZONE`. */
  static readonly TIMEZONE = 'timezone';
  /** Carries `App.TIMEZONE_OFFSET`, in hours. */
  static readonly TIMEZONE_OFFSET = 'timezone-offset';

  /** Carries the tracing id of a request. */
  static readonly REQUEST_TRACING_ID = 'x-request-id';
  /** Carries a `RequestChannel` value. */
  static readonly REQUEST_CHANNEL = 'x-request-channel';

  /** Carries a `RequestCountData` value: what the request asks the server to return. */
  static readonly REQUEST_COUNT_DATA = 'x-request-count';
  /** Carries the count a server sends with a response that is not a list. */
  static readonly RESPONSE_COUNT_DATA = 'x-response-count';

  /** Content types read as text. */
  static readonly TEXTUAL_CONTENT_TYPE_RE =
    /^(application\/(json|.*\+json|xml|.*\+xml|x-www-form-urlencoded|javascript|graphql)|text\/)/i;

  /** A `content-disposition` that marks a file download. */
  static readonly ATTACHMENT_CONTENT_DISPOSITION_RE = /^attachment/i;
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
