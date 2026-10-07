import { getError } from '@venizia/ignis-inversion';
import isPlainObject from 'lodash/isPlainObject.js';
import merge from 'lodash/merge.js';

import { type IFeature } from './feature';

interface IFeatureBundle {
  feature: string;
  bundle?: object;
}

/**
 * The features' messages for one locale, merged. Keys stay flat - no namespace is added - so a key
 * two features both define throws, naming both: a silent "later wins" is a wrong label nobody
 * notices. The application's own sources are layered on top by the i18n provider, not here.
 */
export class FeatureMessages {
  private readonly loaded = new Map<string, object>();

  constructor(private readonly opts: { features: Array<IFeature> }) {}

  /** Whether some feature in the list loads this locale lazily. */
  static hasLoader(opts: { features: Array<IFeature>; locale: string }): boolean {
    const { features, locale } = opts;
    return features.some((feature) => typeof feature.messages?.[locale] === 'function');
  }

  /** Whether a lazy bundle for the locale is still unloaded. */
  isPending(opts: { locale: string }): boolean {
    const { locale } = opts;
    return (
      !this.loaded.has(locale) &&
      FeatureMessages.hasLoader({ features: this.opts.features, locale })
    );
  }

  /** What is available without waiting: every eager bundle, and the lazy ones already loaded. */
  readNow(opts: { locale: string }): object {
    const { locale } = opts;

    const loaded = this.loaded.get(locale);
    if (loaded) {
      return loaded;
    }

    return FeatureMessages.combine({
      locale,
      bundles: this.opts.features.map((feature) => {
        const messages = feature.messages?.[locale];
        return {
          feature: feature.name,
          bundle: typeof messages === 'function' ? undefined : messages,
        };
      }),
    });
  }

  /** Every bundle for the locale, each lazy one loaded once. */
  async read(opts: { locale: string }): Promise<object> {
    const { locale } = opts;

    const loaded = this.loaded.get(locale);
    if (loaded) {
      return loaded;
    }

    const bundles = await Promise.all(
      this.opts.features.map(async (feature) => {
        const messages = feature.messages?.[locale];
        return {
          feature: feature.name,
          bundle: typeof messages === 'function' ? await messages() : messages,
        };
      }),
    );

    const combined = FeatureMessages.combine({ locale, bundles });
    this.loaded.set(locale, combined);
    return combined;
  }

  private static combine(opts: { locale: string; bundles: Array<IFeatureBundle> }): object {
    const { locale, bundles } = opts;
    const owners = new Map<string, string>();

    for (const { feature, bundle } of bundles) {
      for (const key of FeatureMessages.leafKeys({ value: bundle })) {
        const owner = owners.get(key);
        if (owner) {
          throw getError({
            message: `[features] Message '${key}' (${locale}) is defined by both '${owner}' and '${feature}' | Give each feature its own keys, or relabel it in the application's own i18nSources`,
          });
        }
        owners.set(key, feature);
      }
    }

    return merge({}, ...bundles.map(({ bundle }) => bundle ?? {}));
  }

  private static leafKeys(opts: { value: unknown; prefix?: string }): Array<string> {
    const { value, prefix } = opts;

    if (!isPlainObject(value)) {
      return prefix ? [prefix] : [];
    }

    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      return FeatureMessages.leafKeys({ value: child, prefix: prefix ? `${prefix}.${key}` : key });
    });
  }
}
