import type { Container } from '@venizia/ignis-inversion';
import type { I18nProvider } from 'ra-core';

import { CoreBindings } from '@venizia/ardor-kernel';
import type { IAuthProvider, IDataProvider } from '@/common';

interface IResolvedProviders {
  dataProvider: IDataProvider;
  authProvider?: IAuthProvider;
  i18nProvider: I18nProvider;
}

/** Resolves the providers `ArdorApplication` hands to react-admin. */
export class ApplicationProviders {
  /**
   * What `ArdorApplication` resolves from the container when it mounts: the one place, so a test of
   * the boot resolves exactly what the app does. With `isAuthRequired: true`, for an application that
   * always binds a sign-in, `authProvider` is typed as present and an unbound one throws.
   */
  static resolve(opts: { container: Container; isAuthRequired: true }): IResolvedProviders & {
    authProvider: IAuthProvider;
  };
  static resolve(opts: { container: Container; isAuthRequired?: boolean }): IResolvedProviders;
  static resolve(opts: { container: Container; isAuthRequired?: boolean }): IResolvedProviders {
    const { container, isAuthRequired } = opts;

    const dataProvider = container.get<IDataProvider>({
      key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
    });
    // Optional: an application with no sign-in leaves it unbound, and react-admin then runs
    // without an auth provider - every page is public.
    const authProvider = container.get<IAuthProvider>({
      key: CoreBindings.DEFAULT_AUTH_PROVIDER,
      isOptional: !isAuthRequired,
    });
    const i18nProvider = container.get<I18nProvider>({
      key: CoreBindings.DEFAULT_I18N_PROVIDER,
    });

    return { dataProvider, ...(authProvider ? { authProvider } : {}), i18nProvider };
  }
}
