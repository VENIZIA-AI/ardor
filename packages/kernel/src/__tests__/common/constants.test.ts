import { describe, expect, test } from 'bun:test';
import {
  App,
  Environments,
  HeaderConsts,
  RequestBodyTypes,
  RequestMethods,
  RequestTypes,
} from '@/common/constants';
import { CoreBindings, LocalStorageKeys } from '@/common/keys';

describe('RequestMethods scheme validation and members', () => {
  test('RequestMethods.isValid accepts every declared method and rejects foreign strings', () => {
    const declaredMethods = [
      RequestMethods.HEAD,
      RequestMethods.OPTIONS,
      RequestMethods.GET,
      RequestMethods.POST,
      RequestMethods.PUT,
      RequestMethods.PATCH,
      RequestMethods.DELETE,
    ];

    for (const method of declaredMethods) {
      expect(RequestMethods.isValid(method)).toBe(true);
    }

    expect(RequestMethods.isValid('INVALID')).toBe(false);
    expect(RequestMethods.isValid('get')).toBe(false);
    expect(RequestMethods.isValid('')).toBe(false);
  });

  test('RequestMethods.SCHEME_SET contains exactly the declared request methods', () => {
    const declaredMethods = [
      RequestMethods.HEAD,
      RequestMethods.OPTIONS,
      RequestMethods.GET,
      RequestMethods.POST,
      RequestMethods.PUT,
      RequestMethods.PATCH,
      RequestMethods.DELETE,
    ];

    expect(RequestMethods.SCHEME_SET.size).toBe(declaredMethods.length);
    for (const method of declaredMethods) {
      expect(RequestMethods.SCHEME_SET.has(method)).toBe(true);
    }
  });
});

describe('RequestTypes scheme validation and members', () => {
  test('RequestTypes.isValid accepts every declared request type and rejects foreign strings', () => {
    const declaredTypes = [
      RequestTypes.SEND,
      RequestTypes.GET_ONE,
      RequestTypes.GET_LIST,
      RequestTypes.GET_MANY,
      RequestTypes.GET_MANY_REFERENCE,
      RequestTypes.CREATE,
      RequestTypes.UPDATE,
      RequestTypes.UPDATE_MANY,
      RequestTypes.DELETE,
      RequestTypes.DELETE_MANY,
    ];

    for (const type of declaredTypes) {
      expect(RequestTypes.isValid(type)).toBe(true);
    }

    expect(RequestTypes.isValid('FOREIGN_TYPE')).toBe(false);
    expect(RequestTypes.isValid('get_list')).toBe(false);
    expect(RequestTypes.isValid('')).toBe(false);
  });

  test('RequestTypes.SCHEME_SET contains exactly the declared request types', () => {
    const declaredTypes = [
      RequestTypes.SEND,
      RequestTypes.GET_ONE,
      RequestTypes.GET_LIST,
      RequestTypes.GET_MANY,
      RequestTypes.GET_MANY_REFERENCE,
      RequestTypes.CREATE,
      RequestTypes.UPDATE,
      RequestTypes.UPDATE_MANY,
      RequestTypes.DELETE,
      RequestTypes.DELETE_MANY,
    ];

    expect(RequestTypes.SCHEME_SET.size).toBe(declaredTypes.length);
    for (const type of declaredTypes) {
      expect(RequestTypes.SCHEME_SET.has(type)).toBe(true);
    }
  });
});

describe('RequestBodyTypes scheme validation and members', () => {
  test('RequestBodyTypes.isValid accepts every declared body type and rejects foreign strings', () => {
    const declaredBodyTypes = [
      RequestBodyTypes.NONE,
      RequestBodyTypes.FORM_DATA,
      RequestBodyTypes.FORM_URL_ENCODED,
      RequestBodyTypes.JSON,
      RequestBodyTypes.BINARY,
    ];

    for (const bodyType of declaredBodyTypes) {
      expect(RequestBodyTypes.isValid(bodyType)).toBe(true);
    }

    expect(RequestBodyTypes.isValid('multipart')).toBe(false);
    expect(RequestBodyTypes.isValid('text/plain')).toBe(false);
    expect(RequestBodyTypes.isValid('')).toBe(false);
  });

  test('RequestBodyTypes.SCHEME_SET contains exactly the declared request body types', () => {
    const declaredBodyTypes = [
      RequestBodyTypes.NONE,
      RequestBodyTypes.FORM_DATA,
      RequestBodyTypes.FORM_URL_ENCODED,
      RequestBodyTypes.JSON,
      RequestBodyTypes.BINARY,
    ];

    expect(RequestBodyTypes.SCHEME_SET.size).toBe(declaredBodyTypes.length);
    for (const bodyType of declaredBodyTypes) {
      expect(RequestBodyTypes.SCHEME_SET.has(bodyType)).toBe(true);
    }
  });
});

describe('Environments scheme validation and members', () => {
  test('Environments.isValid accepts every declared environment and rejects foreign strings', () => {
    const declaredEnvironments = [Environments.DEVELOPMENT, Environments.PRODUCTION];

    for (const env of declaredEnvironments) {
      expect(Environments.isValid(env)).toBe(true);
    }

    expect(Environments.isValid('staging')).toBe(false);
    expect(Environments.isValid('test')).toBe(false);
    expect(Environments.isValid('')).toBe(false);
  });

  test('Environments.SCHEME_SET contains exactly the declared environments', () => {
    const declaredEnvironments = [Environments.DEVELOPMENT, Environments.PRODUCTION];

    expect(Environments.SCHEME_SET.size).toBe(declaredEnvironments.length);
    for (const env of declaredEnvironments) {
      expect(Environments.SCHEME_SET.has(env)).toBe(true);
    }
  });
});

describe('HeaderConsts regular expressions', () => {
  test('TEXTUAL_CONTENT_TYPE_RE matches textual types and rejects binary types', () => {
    expect(HeaderConsts.TEXTUAL_CONTENT_TYPE_RE.test('application/json')).toBe(true);
    expect(HeaderConsts.TEXTUAL_CONTENT_TYPE_RE.test('application/problem+json')).toBe(true);
    expect(HeaderConsts.TEXTUAL_CONTENT_TYPE_RE.test('text/html')).toBe(true);
    expect(HeaderConsts.TEXTUAL_CONTENT_TYPE_RE.test('application/x-www-form-urlencoded')).toBe(
      true,
    );

    expect(HeaderConsts.TEXTUAL_CONTENT_TYPE_RE.test('image/png')).toBe(false);
    expect(HeaderConsts.TEXTUAL_CONTENT_TYPE_RE.test('application/octet-stream')).toBe(false);
  });

  test('ATTACHMENT_CONTENT_DISPOSITION_RE matches attachment header case-insensitively and rejects inline', () => {
    expect(HeaderConsts.ATTACHMENT_CONTENT_DISPOSITION_RE.test('attachment; filename=x')).toBe(
      true,
    );
    expect(HeaderConsts.ATTACHMENT_CONTENT_DISPOSITION_RE.test('ATTACHMENT; filename=x')).toBe(
      true,
    );
    expect(
      HeaderConsts.ATTACHMENT_CONTENT_DISPOSITION_RE.test('Attachment; filename="doc.pdf"'),
    ).toBe(true);

    expect(HeaderConsts.ATTACHMENT_CONTENT_DISPOSITION_RE.test('inline')).toBe(false);
    expect(HeaderConsts.ATTACHMENT_CONTENT_DISPOSITION_RE.test('form-data; name="field"')).toBe(
      false,
    );
  });
});

describe('CoreBindings and LocalStorageKeys prefixes and uniqueness', () => {
  test('CoreBindings keys all start with @app/application/ and are unique', () => {
    const bindingValues = Object.values(CoreBindings);

    expect(bindingValues.length).toBeGreaterThan(0);
    for (const key of bindingValues) {
      expect(key.startsWith('@app/application/')).toBe(true);
    }

    const uniqueKeys = new Set(bindingValues);
    expect(uniqueKeys.size).toBe(bindingValues.length);
  });

  test('LocalStorageKeys keys all start with @app/auth/ and are unique', () => {
    const storageValues = Object.values(LocalStorageKeys);

    expect(storageValues.length).toBeGreaterThan(0);
    for (const key of storageValues) {
      expect(key.startsWith('@app/auth/')).toBe(true);
    }

    const uniqueKeys = new Set(storageValues);
    expect(uniqueKeys.size).toBe(storageValues.length);
  });
});

describe('App defaults and environment configuration', () => {
  test('App.DEFAULT_DEBOUNCE_TIME is 500', () => {
    expect(App.DEFAULT_DEBOUNCE_TIME).toBe(500);
  });

  test('App.TIMEZONE is a non-empty string', () => {
    expect(typeof App.TIMEZONE).toBe('string');
    expect(App.TIMEZONE.trim().length).toBeGreaterThan(0);
  });
});
