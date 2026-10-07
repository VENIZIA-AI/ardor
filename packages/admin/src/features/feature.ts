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
export type IFeature<TExtension extends object = {}> = IFeatureBase &
  TExtension & {
    resources?: Array<ResourceProps>;
    routes?: Array<RouteProps>;
    /** The application's own `i18nSources` override these. */
    messages?: TFeatureMessages;
  };

/** Types a feature, keeping the shell's extension. */
export const defineFeature = <TExtension extends object = {}>(
  feature: IFeature<TExtension>,
): IFeature<TExtension> => {
  return feature;
};

/** The features the application bound under `CoreBindings.FEATURES`, or none. */
export const readFeatures = <TFeature extends IFeature = IFeature>(opts: {
  container: Container;
}): Array<TFeature> => {
  const { container } = opts;

  if (!container.isBound({ key: CoreBindings.FEATURES })) {
    return [];
  }

  return container.get<Array<TFeature>>({ key: CoreBindings.FEATURES });
};

/**
 * The application's own resources and routes, then each feature's, in order. A resource name
 * mounted twice throws: react-admin would keep one and drop the other without a word.
 */
export const mountFeatures = (opts: {
  features: Array<IFeature>;
  resources?: Array<ResourceProps>;
  routes?: Array<RouteProps>;
}): { resources: Array<ResourceProps>; routes: Array<RouteProps> } => {
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
    resources: [...resources, ...features.flatMap((feature) => feature.resources ?? [])],
    routes: [...routes, ...features.flatMap((feature) => feature.routes ?? [])],
  };
};
