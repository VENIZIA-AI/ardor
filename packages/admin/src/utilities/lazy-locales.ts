/**
 * Which locales an i18n provider still has to load, asked by `Features` without knowing the provider:
 * `DefaultI18nProvider` registers the check for the provider it builds.
 */
export class LazyLocalesUtility {
  private static readonly checks = new WeakMap<object, (opts: { locale: string }) => boolean>();

  static register(opts: {
    provider: object;
    isPending: (opts: { locale: string }) => boolean;
  }): void {
    LazyLocalesUtility.checks.set(opts.provider, opts.isPending);
  }

  static isPending(opts: { provider: object; locale: string }): boolean {
    const check = LazyLocalesUtility.checks.get(opts.provider);

    return check ? check({ locale: opts.locale }) : false;
  }
}
