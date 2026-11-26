import { BindingScopes } from '@venizia/ignis-inversion';

import { AbstractArdorApplication, CoreBindings, DefaultAuthService } from '@venizia/ardor-kernel';
import { ApplicationProviders, DefaultBindingTags } from '@/components/resolve';
import { DefaultAuthProvider } from '@/providers/auth';
import { DefaultI18nProvider } from '@/providers/i18n';
import { DefaultRestDataProvider } from '@/providers/rest-data';

/**
 * The base to extend for an application: implement `bindContext` and `getAppInfo`. It binds the
 * default providers, each a singleton, before anything of the application, so the application binds
 * only their options: `REST_DATA_PROVIDER_OPTIONS`, plus `AUTH_PROVIDER_OPTIONS` (`{ use: true }`)
 * for sign-in and `I18N_PROVIDER_OPTIONS` for more than English. A `@provide` method, `bindingList()`
 * or `bindContext()` under the same key replaces a default. The default data provider reads a list's
 * total from its `Content-Range` header.
 *
 * @example
 * ```ts
 * import { BaseArdorApplication, CoreBindings, type IApplicationInfo } from '@venizia/ardor';
 *
 * export class Application extends BaseArdorApplication {
 *   getAppInfo(): IApplicationInfo {
 *     return { name: 'shop', version: '1.0.0', description: 'The shop admin' };
 *   }
 *
 *   bindContext(): void {
 *     this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({ url: '/api' });
 *     this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({ use: true });
 *   }
 * }
 * ```
 */
export abstract class BaseArdorApplication extends AbstractArdorApplication {
  /**
   * Binds `DefaultAuthService` under `DEFAULT_AUTH_SERVICE`, and `DefaultRestDataProvider`,
   * `DefaultI18nProvider` and `DefaultAuthProvider` as providers under their `DEFAULT_*` keys.
   */
  protected override bindDefaults(): void {
    this.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
      .toClass(DefaultAuthService)
      .setScope(BindingScopes.SINGLETON);
    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      .toProvider(DefaultRestDataProvider)
      .setScope(BindingScopes.SINGLETON);
    this.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
      .toProvider(DefaultI18nProvider)
      .setScope(BindingScopes.SINGLETON);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
      .toProvider(DefaultAuthProvider)
      .setScope(BindingScopes.SINGLETON)
      .setTags(DefaultBindingTags.DEFAULT);
  }

  /**
   * Resolves the providers the application needs, so a missing options binding, or options without
   * the `use` toggle, rejects `start()` and not the first render. A subclass that overrides
   * `postConfigure` calls `super.postConfigure()` first.
   */
  override postConfigure(): void {
    ApplicationProviders.assertConfigured({ container: this });
  }
}
