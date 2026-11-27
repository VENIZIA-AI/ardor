import { describe, expect, test } from 'bun:test';
import {
  App,
  Environments,
  RequestBodyTypes,
  RequestChannel,
  RequestCountData,
  RequestTypes,
} from '@/common/constants';
import { CoreBindings, LocalStorageKeys } from '@/common/keys';

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

  test('RequestTypes.values() contains exactly the declared request types', () => {
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

    expect(RequestTypes.values().length).toBe(declaredTypes.length);

    for (const type of declaredTypes) {
      expect(Array.from<string>(RequestTypes.values())).toContain(type);
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

  test('RequestBodyTypes.values() contains exactly the declared request body types', () => {
    const declaredBodyTypes = [
      RequestBodyTypes.NONE,
      RequestBodyTypes.FORM_DATA,
      RequestBodyTypes.FORM_URL_ENCODED,
      RequestBodyTypes.JSON,
      RequestBodyTypes.BINARY,
    ];

    expect(RequestBodyTypes.values().length).toBe(declaredBodyTypes.length);

    for (const bodyType of declaredBodyTypes) {
      expect(Array.from<string>(RequestBodyTypes.values())).toContain(bodyType);
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

  test('Environments.values() contains exactly the declared environments', () => {
    const declaredEnvironments = [Environments.DEVELOPMENT, Environments.PRODUCTION];

    expect(Environments.values().length).toBe(declaredEnvironments.length);

    for (const env of declaredEnvironments) {
      expect(Array.from<string>(Environments.values())).toContain(env);
    }
  });
});

describe('RequestChannel, RequestCountData, and LocalStorageKeys scheme validation', () => {
  test('RequestChannel.isValid and values() cover declared channels', () => {
    expect(RequestChannel.values().length).toBe(1);
    expect(RequestChannel.isValid(RequestChannel.WEB)).toBe(true);
    expect(RequestChannel.isValid('200_MOBILE')).toBe(false);
  });

  test('RequestCountData.isValid and values() cover declared modes', () => {
    const declared = [RequestCountData.DATA_ONLY, RequestCountData.DATA_WITH_COUNT];
    expect(RequestCountData.values().length).toBe(declared.length);

    for (const entry of declared) {
      expect(RequestCountData.isValid(entry)).toBe(true);
    }

    expect(RequestCountData.isValid('2')).toBe(false);
  });

  test('LocalStorageKeys.isValid and SCHEME_SET cover declared keys', () => {
    const declared = [
      LocalStorageKeys.KEY_AUTH_TOKEN,
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      LocalStorageKeys.KEY_AUTH_PERMISSION,
    ];
    expect(LocalStorageKeys.SCHEME_SET.size).toBe(declared.length);

    for (const entry of declared) {
      expect(LocalStorageKeys.isValid(entry)).toBe(true);
    }

    expect(LocalStorageKeys.isValid('@app/auth/unknown')).toBe(false);
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
    const storageValues = [...LocalStorageKeys.SCHEME_SET];

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
