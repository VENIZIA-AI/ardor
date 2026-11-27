import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderHook } from '@testing-library/react';
import type { AuthProvider, DataProvider, I18nProvider } from 'ra-core';

import { BindingKeys, Container } from '@venizia/ignis-inversion';
import { CoreBindings } from '@venizia/ardor-kernel';
import { ApplicationContext, useInjectable, useProvider } from '@venizia/ardor-react';

import type { TUseTranslateFn } from '@/hooks/use-translate';
import type {
  IAuthProvider,
  IDataProvider,
  TReactAdminAuthProvider,
  TReactAdminDataProvider,
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
      TReactAdminDataProvider,
      Pick<DataProvider, TDataMethods>
    > = true;

    expect(same).toBe(true);
  });

  test('the react-admin auth provider is derived from ra-core AuthProvider', () => {
    const required: TMutuallyAssignable<
      Pick<TReactAdminAuthProvider, 'login' | 'logout' | 'checkAuth' | 'checkError'>,
      Pick<AuthProvider, 'login' | 'logout' | 'checkAuth' | 'checkError'>
    > = true;
    const canAccess: TMutuallyAssignable<
      TReactAdminAuthProvider['canAccess'],
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

  test('send answers unknown data unless a schema checks it', () => {
    const read = async (provider: IDataProvider) => {
      const plain = await provider.send({ resource: 'a', params: { method: 'GET' } });
      const checked = await provider.send({
        resource: 'a',
        params: { method: 'GET' },
        schema: { parse: () => ({ name: 'x' }) },
      });
      const name: string = checked.data.name;
      // @ts-expect-error - `data` is unknown: narrow it, or pass a schema
      const unchecked: string = plain.data.name;
      // @ts-expect-error - a type argument needs the schema that checks it
      await provider.send<{ name: string }>({ resource: 'a', params: { method: 'GET' } });

      return { name, unchecked, total: plain.total };
    };

    expect(typeof read).toBe('function');
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

describe('the provider keys type their hooks', () => {
  const expectSame = (actual: unknown, expected: unknown) => expect(actual).toBe(expected);

  const dataProvider = { getList: () => Promise.resolve({ data: [], total: 0 }) };
  const authProvider = { getRoles: () => Promise.resolve(new Set<string>()) };
  const i18nProvider = { translate: (key: string) => key };

  const createContainer = () => {
    const container = new Container();
    container
      .bind({ key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) })
      .toValue(dataProvider);
    container
      .bind({ key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }) })
      .toValue(authProvider);
    container
      .bind({ key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_I18N_PROVIDER }) })
      .toValue(i18nProvider);

    return container;
  };

  const createWrapper = () => {
    const container = createContainer();

    return ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        ApplicationContext.Provider,
        { value: { container, logger: null } },
        children,
      );
  };

  test('useProvider({ key }) returns the provider the key holds, with no generic', () => {
    const { result } = renderHook(
      () => ({
        data: useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }),
        auth: useProvider({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }),
        i18n: useProvider({ key: CoreBindings.DEFAULT_I18N_PROVIDER }),
      }),
      { wrapper: createWrapper() },
    );

    const data: IDataProvider = result.current.data;
    const auth: IAuthProvider = result.current.auth;
    const i18n: I18nProvider = result.current.i18n;
    // @ts-expect-error - the data provider is not a number: the type is real, not `any`
    const collapsed: number = result.current.data;

    expectSame(data, dataProvider);
    expectSame(auth, authProvider);
    expectSame(i18n, i18nProvider);
    expectSame(collapsed, dataProvider);
  });

  test('useInjectable({ key }) answers the same types', () => {
    const { result } = renderHook(
      () => useInjectable({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }),
      {
        wrapper: createWrapper(),
      },
    );

    const auth: IAuthProvider = result.current;

    expectSame(auth, authProvider);
  });

  test('a generic that equals the mapped type still compiles', () => {
    const { result } = renderHook(
      () => useProvider<IDataProvider>({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }),
      { wrapper: createWrapper() },
    );

    expectSame(result.current, dataProvider);
  });

  test('a key that is not listed anywhere does not compile', () => {
    expect(() =>
      renderHook(
        // @ts-expect-error - 'providers.Unlisted' is not a binding key of the kernel or an augmented key
        () => useProvider({ key: 'providers.Unlisted' }),
        { wrapper: createWrapper() },
      ),
    ).toThrow('providers.Unlisted');
  });
});
