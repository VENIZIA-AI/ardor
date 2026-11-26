import { getError, type Container } from '@venizia/ignis-inversion';
import type { IAuthorizationRequest } from '@venizia/ignis-kernel';
import type { I18nProvider, ResourceProps } from 'ra-core';
import { createContext } from 'react';
import type { RouteProps } from 'react-router-dom';

import { CoreBindings, type IFeatureBase } from '@venizia/ardor-kernel';

import { FeatureMessagesHelper } from '@/helpers/feature-messages';
import { LazyLocales } from '@/utilities/lazy-locales';

/** What a user must be allowed to do, as the permission provider's `canAccess` is asked. */
export interface IRouteAccess extends Pick<IAuthorizationRequest, 'resource' | 'action'> {}

/**
 * A react-router route, plus who may open it and whether it renders inside the layout. react-admin
 * checks neither sign-in nor permission on a custom route: a route with no `access` and no
 * `auth: { use: true }` is open to anyone who types its path. Its React key is `id ?? path`.
 */
export type TArdorRoute = RouteProps & {
  /** The route renders only for a signed-in user whom `canAccess` allows. Implies sign-in. */
  access?: IRouteAccess;
  /**
   * `{ use: true }`: the route renders only for a signed-in user, with no permission check.
   * `{ use: false }`: the route is public; with `access` it is refused at mount. Under react-admin
   * `requireAuth`, only a route outside the layout is reachable signed out.
   */
  auth?: { use: boolean };
  /**
   * `{ use: false }`: the route renders outside the layout. react-admin guards only the pages of the layout
   * under `requireAuth`, so ARDOR guards a route outside it too: it needs a signed-in user unless it says
   * `auth: { use: false }` (a sign-in or accept-invite page).
   */
  layout?: { use: false };
};

/** Per locale: the messages, or a loader for them. */
export type TFeatureMessages = Record<string, object | (() => Promise<object>)>;

/** A menu link of a feature, as `useMenuEntries` lists it. ARDOR renders no menu: the shell does. */
export interface IMenuEntry {
  /** A translation key. */
  label: string;
  /** The path the entry links to. */
  to: string;
  /** The entry is listed only for a user whom `canAccess` allows. */
  access?: IRouteAccess;
  /** An icon name the shell maps to an icon; ARDOR carries it and never reads it. */
  icon?: string;
}

/**
 * A feature package: what it registers in the container (`IFeatureBase`), plus what it mounts in the
 * admin - resources, routes, messages and menu entries. `TExtension` is what a shell adds on top;
 * ARDOR carries it and never reads it.
 */
export type TFeature<TExtension extends object = {}> = IFeatureBase &
  TExtension & {
    resources?: Array<ResourceProps>;
    routes?: Array<TArdorRoute>;
    /** The application's own `i18nSources` override these. */
    messages?: TFeatureMessages;
    /** The feature's menu links, in order; `useMenuEntries` lists those the user may open. */
    menu?: Array<IMenuEntry>;
  };

/**
 * A container that binds only `CoreBindings.FEATURES`, to the features `ArdorApplication` mounts, so
 * `Features.read` reads them; `undefined` outside the shell.
 */
export const MountedFeaturesContext = createContext<Container | undefined>(undefined);

/**
 * Defines, reads, mounts and loads the messages of the features an application binds.
 *
 * @useWhen you define a feature, or read, mount and load the messages of the features an application binds
 * @insteadOf a hand-built registry of resources, routes and menu entries
 */
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
   * The application's own resources and routes, then each feature's, in order. A resource name or a
   * route path mounted twice, a route path equal to `/<resource name>`, a route with neither `id`
   * nor `path`, and a route with `access` and `auth: { use: false }` throw: react-router and
   * react-admin would keep one of two and drop the other without a word.
   */
  static mount(opts: {
    features: Array<TFeature>;
    /** @default [] */
    resources?: Array<ResourceProps>;
    /** @default [] */
    routes?: Array<TArdorRoute>;
  }): { resources: Array<ResourceProps>; routes: Array<TArdorRoute> } {
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

    const paths = new Map<string, string>();

    for (const [name, owner] of owners) {
      paths.set(Features.normalizePath({ path: name }), `'${owner}' (resource '${name}')`);
    }

    const claimRoutes = (entry: { owner: string; routes: Array<TArdorRoute> }) => {
      for (const route of entry.routes) {
        Features.assertRoute({ owner: entry.owner, route });

        if (route.path === undefined) {
          continue;
        }

        const path = Features.normalizePath({
          path: route.path,
          isCaseSensitive: route.caseSensitive === true,
        });
        const owner = paths.get(path);

        if (owner) {
          throw getError({
            message: `[features] Route '/${route.path.replace(/^\/+|\/+$/g, '')}' is mounted by both ${owner} and '${entry.owner}' | A route path is unique within an application and is not the path of a resource`,
          });
        }

        paths.set(path, `'${entry.owner}'`);
      }
    };

    claimRoutes({ owner: 'the application', routes });

    for (const feature of features) {
      claimRoutes({ owner: feature.name, routes: feature.routes ?? [] });
    }

    return {
      resources: [...resources, ...features.flatMap((feature) => feature.resources ?? [])],
      routes: [...routes, ...features.flatMap((feature) => feature.routes ?? [])],
    };
  }

  private static assertRoute(opts: { owner: string; route: TArdorRoute }): void {
    const { owner, route } = opts;

    if (route.id === undefined && route.path === undefined) {
      throw getError({
        message: `[features] A route of '${owner}' has neither an id nor a path | Give it a path, or an id when it has no path`,
      });
    }

    if (route.access && route.auth?.use === false) {
      throw getError({
        message: `[features] Route '${route.path ?? route.id}' of '${owner}' has access and auth: { use: false } | A route with access needs a signed-in user: drop auth, or drop access`,
      });
    }
  }

  /**
   * The path as react-router compares it: without its leading and trailing slashes, and in lower case unless
   * the route is `caseSensitive`, so `orders`, `/orders`, `/Orders/` compare equal.
   */
  private static normalizePath(opts: { path: string; isCaseSensitive?: boolean }): string {
    const trimmed = opts.path.replace(/^\/+|\/+$/g, '');

    return opts.isCaseSensitive ? trimmed : trimmed.toLowerCase();
  }

  /** Whether a feature or the application's own source loads the provider's current locale lazily, so a first render must wait for it. */
  static hasPendingMessages(opts: {
    features: Array<TFeature>;
    i18nProvider: I18nProvider;
  }): boolean {
    const { features, i18nProvider } = opts;
    const locale = i18nProvider.getLocale();

    return (
      FeatureMessagesHelper.hasLoader({ features, locale }) ||
      LazyLocales.isPending({ provider: i18nProvider, locale })
    );
  }

  /**
   * Loads the lazy messages of the locale: `changeLocale()` to the same locale loads them before
   * react-admin renders. With `DefaultI18nProvider` a failed load is logged and never rejects; a custom provider's rejection is passed on.
   */
  static async loadMessages(opts: {
    features: Array<TFeature>;
    i18nProvider: I18nProvider;
    /** The locale to load. @default i18nProvider.getLocale() */
    locale?: string;
  }): Promise<void> {
    const { features, i18nProvider } = opts;
    const locale = opts.locale ?? i18nProvider.getLocale();

    if (
      !FeatureMessagesHelper.hasLoader({ features, locale }) &&
      !LazyLocales.isPending({ provider: i18nProvider, locale })
    ) {
      return;
    }

    await i18nProvider.changeLocale(locale);
  }

  /**
   * Loads and merges the features' messages of every locale in `locales`, as the i18n provider
   * would, without changing the locale of any provider. Rejects with the first failure: a feature
   * loader that rejects, or a key two features define.
   */
  static async verifyMessages(opts: {
    features: Array<TFeature>;
    locales: Array<string>;
  }): Promise<void> {
    const messages = new FeatureMessagesHelper({ features: opts.features });

    await Promise.all(opts.locales.map((locale) => messages.read({ locale })));
  }
}
