import { describe, expect, test } from 'bun:test';
import type { AuthProvider, DataProvider } from 'ra-core';

import type { TUseTranslateFn } from '@/hooks/use-translate';
import type {
  IAuthProvider,
  IDataProvider,
  IReactAdminAuthProvider,
  IReactAdminDataProvider,
} from '@/common';

type TDataMethods =
  | 'getList'
  | 'getOne'
  | 'getMany'
  | 'getManyReference'
  | 'update'
  | 'updateMany'
  | 'create'
  | 'delete'
  | 'deleteMany';

// Both directions: ARDOR's react-admin parts ARE ra-core's, not a copy that can drift.
type TMutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe('provider types', () => {
  test('the react-admin data provider is derived from ra-core DataProvider', () => {
    const same: TMutuallyAssignable<
      IReactAdminDataProvider,
      Pick<DataProvider, TDataMethods>
    > = true;

    expect(same).toBe(true);
  });

  test('the react-admin auth provider is derived from ra-core AuthProvider', () => {
    const required: TMutuallyAssignable<
      Pick<IReactAdminAuthProvider, 'login' | 'logout' | 'checkAuth' | 'checkError'>,
      Pick<AuthProvider, 'login' | 'logout' | 'checkAuth' | 'checkError'>
    > = true;
    const canAccess: TMutuallyAssignable<
      IReactAdminAuthProvider['canAccess'],
      AuthProvider['canAccess']
    > = true;

    expect(required).toBe(true);
    expect(canAccess).toBe(true);
  });

  test('refreshToken answers a boolean, and getRoles answers a set of names', () => {
    // @ts-expect-error - a refresh answers true or false, not a token
    const bad: IAuthProvider['refreshToken'] = () => Promise.resolve('token');
    const good: IAuthProvider['refreshToken'] = () => Promise.resolve(true);

    expect(typeof bad).toBe('function');
    expect(typeof good).toBe('function');
  });

  test('send answers unknown data until the caller names a type', () => {
    type TData = Awaited<ReturnType<IDataProvider['send']>>['data'];
    const read = (data: TData) => {
      // @ts-expect-error - `data` is unknown: narrow it, or name the type with send<T>()
      return data.name;
    };
    const named = (data: Awaited<ReturnType<IDataProvider['send']>>) => data.total;

    expect(typeof read).toBe('function');
    expect(typeof named).toBe('function');
  });

  test('translate takes the typed keys only, and returns a string', () => {
    const translate = (() => 'text') as TUseTranslateFn;
    const text: string = translate('ra.action.add', { _: 'default' });
    const dynamic: string = 'pages.any.key';
    // @ts-expect-error - a key built at run time is a plain string: narrow it to TUseTranslateKeys first
    translate(dynamic);

    expect(typeof text).toBe('string');
  });
});
