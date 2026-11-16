import { type Container, getError } from '@venizia/ignis-inversion';
import type { I18nProvider } from 'ra-core';

import { CoreBindings, type TAuthProviderOptions } from '@venizia/ardor-kernel';
import type { IAuthProvider, IDataProvider } from '@/common';

interface IResolvedProviders {
  dataProvider: IDataProvider;
  authProvider?: IAuthProvider;
  i18nProvider: I18nProvider;
}

/** The tag `BaseArdorApplication.bindDefaults()` puts on the bindings it makes, so a binding of the application is told apart. */
export class DefaultBindingTags {
  static readonly DEFAULT = 'ardor.default';
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

    // Options without the toggle come from an app written before it: failing here beats every page going public.
    if (authOptions !== undefined && typeof authOptions.use !== 'boolean') {
      throw getError({
        message: `[ApplicationProviders.resolve] ${CoreBindings.AUTH_PROVIDER_OPTIONS} has no use toggle | Bind { use: true, ...paths } to sign in, or { use: false } for an app with no sign-in`,
      });
    }

    // A 0.4.7 app binds its own auth provider and no options: sign-in would be off and the provider dropped, every page public.
    if (
      authOptions === undefined &&
      container.isBound({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
    ) {
      const binding = container.getBinding({ key: CoreBindings.DEFAULT_AUTH_PROVIDER });

      if (!binding?.hasTag(DefaultBindingTags.DEFAULT)) {
        throw getError({
          message: `[ApplicationProviders.resolve] ${CoreBindings.DEFAULT_AUTH_PROVIDER} holds an auth provider of the application, but ${CoreBindings.AUTH_PROVIDER_OPTIONS} is not bound, so sign-in would be off and the provider ignored | Bind { use: true, ...paths } to use it, or { use: false } for an app with no sign-in`,
        });
      }
    }

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

  /**
   * Resolves the providers `resolve` resolves, now, and throws one error that names the binding key
   * and says what to bind, so a missing binding fails at boot and not in the middle of a render. Call
   * it in `postConfigure()`. A transient provider is built once more than the render builds it.
   *
   * @param opts.isAuthRequired - `true` for an application that always binds a sign-in: an unbound auth provider fails too.
   */
  static assertConfigured(opts: { container: Container; isAuthRequired?: boolean }): void {
    try {
      ApplicationProviders.resolve(opts);
    } catch (error) {
      throw ApplicationProviders.explainFailure({ error });
    }
  }

  private static explainFailure(opts: { error: unknown }): Error {
    const { error } = opts;
    const extra = typeof error === 'object' && error !== null ? Reflect.get(error, 'extra') : null;
    const unboundKey: unknown =
      typeof extra === 'object' && extra !== null ? Reflect.get(extra, 'unboundKey') : undefined;

    if (typeof unboundKey === 'string') {
      return getError({
        message: `[ApplicationProviders.assertConfigured] '${unboundKey}' is not bound | Bind it in a @configuration() class (@provideOption for an options key) or in bindContext()`,
      });
    }

    const reason = error instanceof Error ? error.message : String(error);

    return getError({
      message: `[ApplicationProviders.assertConfigured] The providers could not be built: ${reason} | Fix the binding the message names`,
    });
  }
}
