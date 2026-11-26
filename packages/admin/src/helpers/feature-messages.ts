import { BaseHelper, RecordUtility } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';
import type { StringMap } from 'ra-core';

import { mergeMessages } from '@/common/merge';
import type { TFeature } from '@/features/feature';
import { unwrapMessages } from './locale-sources';

interface IFeatureBundle {
  feature: string;
  bundle?: object;
}

/**
 * The features' messages for one locale, merged. Keys stay flat - no namespace is added - so a key
 * two features both define throws, naming both: a silent "later wins" is a wrong label nobody
 * notices. The application's own sources are layered on top by the i18n provider, not here.
 */
export class FeatureMessagesHelper extends BaseHelper {
  private readonly loaded = new Map<string, object>();
  /** Each lazy bundle's load, by locale and feature: one call, kept once it delivered, dropped when it fails. */
  private readonly loads = new Map<string, Promise<object>>();

  constructor(private readonly opts: { features: Array<TFeature> }) {
    super({ scope: FeatureMessagesHelper.name });
  }

  /** Whether some feature in the list loads this locale lazily. */
  static hasLoader(opts: { features: Array<TFeature>; locale: string }): boolean {
    const { features, locale } = opts;

    return features.some((feature) => typeof feature.messages?.[locale] === 'function');
  }

  /** Whether a lazy bundle for the locale is still unloaded. */
  isPending(opts: { locale: string }): boolean {
    const { locale } = opts;

    return (
      !this.loaded.has(locale) &&
      FeatureMessagesHelper.hasLoader({ features: this.opts.features, locale })
    );
  }

  /** What is available without waiting: every eager bundle, and the lazy ones already loaded. */
  readNow(opts: { locale: string }): object {
    const { locale } = opts;

    const loaded = this.loaded.get(locale);

    if (loaded) {
      return loaded;
    }

    return this.combine({
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
      this.opts.features.map(async (feature, index) => {
        const messages = feature.messages?.[locale];

        if (typeof messages !== 'function') {
          return { feature: feature.name, bundle: messages };
        }

        const bundle = await this.load({
          key: `${locale}:${index}`,
          owner: `'${feature.name}' (${locale})`,
          loader: () => messages(),
        });

        return { feature: feature.name, bundle };
      }),
    );

    const combined = this.combine({ locale, bundles });
    this.loaded.set(locale, combined);

    return combined;
  }

  private load(opts: {
    key: string;
    owner: string;
    loader: () => Promise<object>;
  }): Promise<object> {
    const { key, owner, loader } = opts;
    const waiting = this.loads.get(key);

    if (waiting) {
      return waiting;
    }

    const task = loader().then((value) => unwrapMessages({ value, owner }));
    this.loads.set(key, task);
    task.catch(() => this.loads.delete(key));

    return task;
  }

  private combine(opts: { locale: string; bundles: Array<IFeatureBundle> }): object {
    const { locale, bundles } = opts;
    const owners = new Map<string, string>();

    for (const { feature, bundle } of bundles) {
      for (const key of FeatureMessagesHelper.leafKeys({ value: bundle })) {
        const owner = owners.get(key);

        if (owner) {
          throw getError({
            message: `[features] Message '${key}' (${locale}) is defined by both '${owner}' and '${feature}' | Give each feature its own keys, or relabel it in the application's own i18nSources`,
          });
        }

        owners.set(key, feature);
      }
    }

    const merged: StringMap = {};

    for (const { feature, bundle } of bundles) {
      const skipped = mergeMessages({ target: merged, sources: [bundle ?? {}] });

      if (skipped.length > 0) {
        this.logger.warn(
          '[combine] Messages of the wrong shape are left out of the feature %s (%s) | keys: %s',
          feature,
          locale,
          skipped.join(', '),
        );
      }
    }

    return merged;
  }

  private static leafKeys(opts: { value: unknown; prefix?: string }): Array<string> {
    const { value, prefix } = opts;

    if (!RecordUtility.isPlainRecord(value)) {
      return prefix ? [prefix] : [];
    }

    return Object.entries(value).flatMap(([key, child]) => {
      return FeatureMessagesHelper.leafKeys({
        value: child,
        prefix: prefix ? `${prefix}.${key}` : key,
      });
    });
  }
}
