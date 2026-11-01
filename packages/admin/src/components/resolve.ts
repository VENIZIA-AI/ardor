import type { Container } from '@venizia/ignis-inversion';
import type { I18nProvider } from 'ra-core';

import { CoreBindings } from '@venizia/ardor-kernel';
import type { IAuthProvider, IDataProvider } from '@/common';

export class ApplicationProviders {
  /**
   * What `ArdorApplication` resolves from the container when it mounts: the one place, so a test of
   * the boot resolves exactly what the app does.
   */
  static resolve(opts: { container: Container }): {
    dataProvider: IDataProvider;
    authProvider?: IAuthProvider;
    i18nProvider: I18nProvider;
  } {
    const { container } = opts;

    const dataProvider = container.get<IDataProvider>({
      key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
    });
    // Optional: an application with no sign-in leaves it unbound, and react-admin then runs
    // without an auth provider - every page is public.
    const authProvider = container.get<IAuthProvider>({
      key: CoreBindings.DEFAULT_AUTH_PROVIDER,
      isOptional: true,
    });
    const i18nProvider = container.get<I18nProvider>({
      key: CoreBindings.DEFAULT_I18N_PROVIDER,
    });

    return { dataProvider, ...(authProvider ? { authProvider } : {}), i18nProvider };
  }
}
