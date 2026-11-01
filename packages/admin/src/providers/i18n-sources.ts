import { getError } from '@venizia/ignis-inversion';
import type { ILogger } from '@venizia/ignis-helpers/core';

import type { TI18nSource } from '@/common';

/**
 * The application's own message sources, by locale: an object read at once, or a loader read the
 * first time its locale is used. A loader that fails (a remote file that is down, a chunk that
 * did not arrive) is logged and answered with nothing, so the provider falls back to the English
 * messages instead of stopping the admin; a failure is not remembered, so the next
 * `changeLocale()` tries again.
 */
export class LocaleSources {
  private readonly loaded = new Map<string, object>();

  constructor(private readonly opts: { sources: Record<string, TI18nSource>; logger: ILogger }) {}

  /** Whether the locale's source is a loader that has not delivered yet. */
  isPending(opts: { locale: string }): boolean {
    const { locale } = opts;

    return LocaleSources.isLoader(this.opts.sources[locale]) && !this.loaded.has(locale);
  }

  /** What is available without waiting: an object source, or a loaded loader. */
  readNow(opts: { locale: string }): object | undefined {
    const { locale } = opts;
    const source = this.opts.sources[locale];

    return LocaleSources.isLoader(source) ? this.loaded.get(locale) : source;
  }

  /** The messages of the locale, a loader called until it delivers; `undefined` when there is none or the load failed. */
  read(opts: { locale: string }): Promise<object | undefined> {
    const { locale } = opts;
    const source = this.opts.sources[locale];

    if (!LocaleSources.isLoader(source)) {
      return Promise.resolve(source);
    }

    const loaded = this.loaded.get(locale);

    return loaded ? Promise.resolve(loaded) : this.load({ locale, loader: source });
  }

  /** A type predicate has to take its subject as the parameter, not inside an `opts` object. */
  private static isLoader(source: TI18nSource | undefined): source is () => Promise<object> {
    return typeof source === 'function';
  }

  private async load(opts: {
    locale: string;
    loader: () => Promise<object>;
  }): Promise<object | undefined> {
    const { locale, loader } = opts;

    try {
      const result = await loader();
      const messages = LocaleSources.unwrap({ locale, value: result });
      this.loaded.set(locale, messages);

      return messages;
    } catch (error) {
      this.opts.logger.error(
        '[load] Locale %s failed to load, English is used | error: %o',
        locale,
        error,
      );

      return undefined;
    }
  }

  /**
   * What a loader resolves to is the messages, or an ES module whose default export is the messages
   * (`() => import('./vi')`). Anything else is a failed load.
   */
  private static unwrap(opts: { locale: string; value: unknown }): object {
    const { locale, value } = opts;
    const isModule =
      typeof value === 'object' &&
      value !== null &&
      Reflect.get(value, Symbol.toStringTag) === 'Module';
    const messages: unknown = isModule ? Reflect.get(value, 'default') : value;

    if (typeof messages !== 'object' || messages === null) {
      throw getError({
        message: `[i18n] The loader of '${locale}' did not resolve to messages | Return them, or a module with them as its default export`,
      });
    }

    return messages;
  }
}

/**
 * Which locales an i18n provider still has to load, asked by `Features` without knowing the provider:
 * `DefaultI18nProvider` registers the check for the provider it builds.
 */
export class LazyLocales {
  private static readonly checks = new WeakMap<object, (opts: { locale: string }) => boolean>();

  static register(opts: {
    provider: object;
    isPending: (opts: { locale: string }) => boolean;
  }): void {
    LazyLocales.checks.set(opts.provider, opts.isPending);
  }

  static isPending(opts: { provider: object; locale: string }): boolean {
    const check = LazyLocales.checks.get(opts.provider);

    return check ? check({ locale: opts.locale }) : false;
  }
}
