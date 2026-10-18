import { describe, expect, test } from 'bun:test';
import {
  Environments,
  RequestBodyTypes,
  RequestCountData,
  RequestMethods,
  RequestTypes,
} from '@/common/constants';
import type {
  AnyType,
  TConstValue,
  TEnvironment,
  TNumberConstValue,
  TRequestBodyType,
  TRequestMethod,
  TRequestType,
  TStringConstValue,
  TPaths,
} from '@/common/types';

class TimeModes {
  static readonly HALF_DAY = '12h';
  static readonly FULL_DAY = '24h';
  static readonly ONE = 1;
  static readonly TWO = 2;
}

/**
 * The assertions are compile-time: `make typecheck-all` fails when they break.
 * Each mapped result is held in an unannotated const first. An annotated target gives the
 * object literal a contextual type and hides widening, so a direct assignment would witness nothing.
 */
describe('const-value types keep their literal union through inference', () => {
  test('TStringConstValue survives an object literal built by map', () => {
    const values: TStringConstValue<typeof TimeModes>[] = [TimeModes.HALF_DAY, TimeModes.FULL_DAY];
    const options = values.map((value) => ({ value, label: String(value) }));
    const typed: { value: '12h' | '24h'; label: string }[] = options;

    // @ts-expect-error '6h' is not a TimeModes string value
    const foreign: TStringConstValue<typeof TimeModes> = '6h';

    expect(typed.map((option) => option.value)).toEqual(['12h', '24h']);
    expect<string>(foreign).toBe('6h');
  });

  test('TNumberConstValue survives an object literal property', () => {
    const values: TNumberConstValue<typeof TimeModes>[] = [TimeModes.ONE, TimeModes.TWO];
    const holder = { current: values[1] };
    const typed: 1 | 2 = holder.current;

    // @ts-expect-error 3 is not a TimeModes number value
    const foreign: TNumberConstValue<typeof TimeModes> = 3;

    expect(typed).toBe(2);
    expect<number>(foreign).toBe(3);
  });

  test('TConstValue keeps both the string and the number values', () => {
    const values: TConstValue<typeof TimeModes>[] = [TimeModes.HALF_DAY, TimeModes.TWO];
    const options = values.map((value) => ({ value, label: String(value) }));
    const typed: { value: '12h' | '24h' | 1 | 2; label: string }[] = options;

    const counts: TConstValue<typeof RequestCountData>[] = [RequestCountData.DATA_WITH_COUNT];
    const countOptions = counts.map((value) => ({ value, label: String(value) }));
    const typedCounts: { value: '0' | '1'; label: string }[] = countOptions;

    expect(typed.map((option) => option.value)).toEqual(['12h', 2]);
    expect(typedCounts[0].value).toBe('1');
  });

  test('TRequestMethod and TEnvironment aliases keep their literal union', () => {
    const methods: TRequestMethod[] = [RequestMethods.GET, RequestMethods.POST];
    const methodOptions = methods.map((value) => ({ value, label: String(value) }));
    const typedMethods: {
      value: 'HEAD' | 'OPTIONS' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    }[] = methodOptions;

    const environments: TEnvironment[] = [Environments.PRODUCTION];
    const environmentOptions = environments.map((value) => ({ value, label: String(value) }));
    const typedEnvironments: { value: 'development' | 'production' }[] = environmentOptions;

    // @ts-expect-error 'TRACE' is not a RequestMethods value
    const foreign: TRequestMethod = 'TRACE';

    expect(typedMethods.map((option) => option.value)).toEqual(['GET', 'POST']);
    expect(typedEnvironments[0].value).toBe('production');
    expect<string>(foreign).toBe('TRACE');
  });

  test('TRequestType and TRequestBodyType keep their literal union', () => {
    const requestTypes: TRequestType[] = [RequestTypes.SEND];
    const requestTypeOptions = requestTypes.map((value) => ({ value }));
    const typedRequestTypes: { value: TRequestType }[] = requestTypeOptions;

    const bodyTypes: TRequestBodyType[] = [RequestBodyTypes.JSON];
    const bodyTypeOptions = bodyTypes.map((value) => ({ value }));
    const typedBodyTypes: { value: TRequestBodyType }[] = bodyTypeOptions;

    expect(typedRequestTypes[0].value).toBe('SEND');
    expect(typedBodyTypes[0].value).toBe('json');
  });

  test('a member declared as plain string stays string', () => {
    class Labels {
      static readonly DEFAULT: string = 'default';
    }

    const values: TStringConstValue<typeof Labels>[] = [Labels.DEFAULT, 'anything'];

    expect(values).toEqual(['default', 'anything']);
  });
});

interface ITreeState {
  title: string;
  isLoading: { user: boolean; license: boolean };
  user: { profile: { name: string; tags: Array<string> } } | null;
  createdAt: Date;
  visited: Set<string>;
  lookup: Map<string, number>;
  onClick: () => void;
  payload: AnyType;
  deep: { a: { b: { c: { d: { e: { f: number } } } } } };
}

/** Compile-time: `make typecheck-all` fails when an assertion breaks. */
describe('TPaths reads every path of a state, with no depth written down', () => {
  test('names nested keys of any depth and treats arrays and built-ins as leaves', () => {
    const paths: TPaths<ITreeState>[] = [
      'title',
      'isLoading',
      'isLoading.user',
      'user',
      'user.profile',
      'user.profile.name',
      'user.profile.tags',
      'createdAt',
      'visited',
      'lookup',
      'onClick',
      'payload',
      'deep.a.b.c.d.e.f',
    ];

    // @ts-expect-error a key the state does not have
    const unknownKey: TPaths<ITreeState> = 'isLoading.admin';
    // @ts-expect-error an array has no paths below it
    const belowArray: TPaths<ITreeState> = 'user.profile.tags.0';
    // @ts-expect-error a Date is a leaf: its methods are not state
    const belowDate: TPaths<ITreeState> = 'createdAt.getTime';
    // @ts-expect-error a Set is a leaf
    const belowSet: TPaths<ITreeState> = 'visited.size';
    // @ts-expect-error a function is a leaf
    const belowFunction: TPaths<ITreeState> = 'onClick.name';

    expect(paths.length).toBe(13);
    expect([unknownKey, belowArray, belowDate, belowSet, belowFunction].length).toBe(5);
  });

  test('an any field is a leaf, never a path to everything', () => {
    // @ts-expect-error `payload` is any: nothing below it is named
    const belowAny: TPaths<ITreeState> = 'payload.anything';

    expect<string>(belowAny).toBe('payload.anything');
  });
});
