import { getError, type Container } from '@venizia/ignis-inversion';
import type { ResourceProps } from 'ra-core';
import type { RouteProps } from 'react-router-dom';

import { CoreBindings, type IFeatureBase } from '@venizia/ardor-kernel';

/** Per locale: the messages, or a loader for them. */
export type TFeatureMessages = Record<string, object | (() => Promise<object>)>;

/**
 * A feature package: what it registers in the container (`IFeatureBase`), plus what it mounts in the
 * admin - resources, routes and messages. `TExtension` is what a shell adds on top, such as menu
 * entries; ARDOR carries it and never reads it.
 */
export type TFeature<TExtension extends object = {}> = IFeatureBase &
  TExtension & {
    resources?: Array<ResourceProps>;
    routes?: Array<RouteProps>;
    /** The application's own `i18nSources` override these. */
    messages?: TFeatureMessages;
  };

export class Features {
  /** Types a feature, keeping the shell's extension. */
  static define<TExtension extends object = {}>(
    feature: TFeature<TExtension>,
  ): TFeature<TExtension> {
    return feature;
  }

  /** The features the application bound under `CoreBindings.FEATURES`, or none. */
  static read<TItem extends TFeature = TFeature>(opts: { container: Container }): Array<TItem> {
    const { container } = opts;

    if (!container.isBound({ key: CoreBindings.FEATURES })) {
      return [];
    }

    return container.get<Array<TItem>>({ key: CoreBindings.FEATURES });
  }

  /**
   * The application's own resources and routes, then each feature's, in order. A resource name
   * mounted twice throws: react-admin would keep one and drop the other without a word.
   */
  static mount(opts: {
    features: Array<TFeature>;
    resources?: Array<ResourceProps>;
    routes?: Array<RouteProps>;
  }): { resources: Array<ResourceProps>; routes: Array<RouteProps> } {
    const { features, resources = [], routes = [] } = opts;

    const owners = new Map<string, string>();
    const claim = (entry: { owner: string; resources: Array<ResourceProps> }) => {
      for (const resource of entry.resources) {
        const owner = owners.get(resource.name);
        if (owner) {
          throw getError({
            message: `[features] Resource '${resource.name}' is mounted by both '${owner}' and '${entry.owner}' | A resource name is unique within an application`,
          });
        }
        owners.set(resource.name, entry.owner);
      }
    };

    claim({ owner: 'the application', resources });
    for (const feature of features) {
      claim({ owner: feature.name, resources: feature.resources ?? [] });
    }

    return {
      resources: [...resources, ...features.flatMap(feature => feature.resources ?? [])],
      routes: [...routes, ...features.flatMap(feature => feature.routes ?? [])],
    };
  }
}
