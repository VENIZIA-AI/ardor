import { type Container, getError } from '@venizia/ignis-inversion';
import type { I18nProvider } from 'ra-core';

import { CoreBindings, type TAuthProviderOptions } from '@venizia/ardor-kernel';
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
   * the boot resolves exactly what the app does. The auth provider is resolved only when
   * `AUTH_PROVIDER_OPTIONS` is `{ use: true }`; unbound or `{ use: false }` leaves it out. With
   * `isAuthRequired: true`, for an application that always signs in, `authProvider` is typed as
   * present, and sign-in off or an unbound provider throws.
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
    const authOptions = container.get<TAuthProviderOptions>({
      key: CoreBindings.AUTH_PROVIDER_OPTIONS,
      isOptional: true,
    });
    const isSignInOn = authOptions?.use === true;

    if (isAuthRequired && !isSignInOn) {
      throw getError({
        message:
          '[ApplicationProviders.resolve] isAuthRequired is true but sign-in is off | Bind CoreBindings.AUTH_PROVIDER_OPTIONS to { use: true }',
      });
    }

    // Without sign-in react-admin runs with no auth provider: every page is public.
    const authProvider = isSignInOn
      ? container.get<IAuthProvider>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
      : undefined;
    const i18nProvider = container.get<I18nProvider>({
      key: CoreBindings.DEFAULT_I18N_PROVIDER,
    });

    return { dataProvider, ...(authProvider ? { authProvider } : {}), i18nProvider };
  }
}
