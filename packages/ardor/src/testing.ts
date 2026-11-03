import * as inversion from '@venizia/ignis-inversion';

import { ApplicationProviders, Features } from '@venizia/ardor-admin';
import { CoreBindings, type BaseArdorApplication } from '@venizia/ardor-kernel';

/** A class (matched exactly), a class name, or a binding key; the shape the shared core takes. */
export type TBootSkip = inversion.TBindingSkip;

export interface IAssertArdorApplicationBootsOptions {
  /**
   * Bindings the check leaves unresolved, for the few that open a socket or read the page when
   * they are built. A name that matches no binding rejects: a typo must not skip silently.
   *
   * It applies to the binding check only: the bindings of the five namespaces below. The provider
   * step (data, auth, i18n) always builds what the application bound, and a provider key such as
   * `CoreBindings.DEFAULT_AUTH_PROVIDER` is outside those namespaces, so naming it rejects as a
   * skip that matched nothing. To leave a provider out, leave it unbound.
   */
  skipBindings?: Array<TBootSkip>;

  /** The locale whose messages must load. Default: the i18n provider's initial one. */
  locale?: string;

  /**
   * Default `false`: an application with no service, repository, datasource, component or
   * configuration and no feature proves nothing (usually the artifact index was empty).
   */
  allowEmpty?: boolean;
}

/** The namespaces ARDOR binds its stereotyped classes under; the check resolves each binding of them. */
const VERIFIED_NAMESPACES = [
  'services',
  'repositories',
  'datasources',
  'components',
  'configurations',
];

const SCOPE = 'assertArdorApplicationBoots';

const bootedApplications = new WeakSet<object>();

const fail = (message: string): never => {
  throw inversion.getError({ message: `[${SCOPE}] ${message}` });
};

/**
 * Proves an ARDOR application boots, without a browser and without a network: it runs `start()`,
 * resolves every service, repository, datasource, component and configuration the application
 * bound, then resolves what opening the app resolves (the data, auth and i18n providers, the
 * features, the messages of the first locale). It stops at the first failure, with the error the
 * app would raise; the check over the bindings reports every failure at once and names who needs
 * each missing key.
 *
 * `fetch` is replaced for the run by a function that rejects, so nothing leaves the process. The
 * application stays started and is returned. A failed boot leaves a half-started instance, so
 * build a new one (pass a factory) for each call.
 */
export const assertArdorApplicationBoots = async <Application extends BaseArdorApplication>(
  application: Application | (() => Application | Promise<Application>),
  options: IAssertArdorApplicationBootsOptions = {},
): Promise<Application> => {
  const { skipBindings, locale, allowEmpty = false } = options;

  if (typeof inversion.BindingVerifier?.assertResolve !== 'function') {
    fail(
      'The installed @venizia/ignis-inversion has no BindingVerifier.assertResolve | It arrived in 0.4.6-1: upgrade the peer to ^0.4.6, or this helper cannot check the bindings',
    );
  }

  let target: Application;

  if (typeof application === 'function') {
    const created = await application();
    target = created;
  } else {
    target = application;
  }

  if (
    bootedApplications.has(target) ||
    target.isBound({ key: CoreBindings.APPLICATION_INSTANCE })
  ) {
    fail(
      'This application instance was already started | A failed or finished start leaves registrations behind, so build a new instance (pass a factory) for each call',
    );
  }
  bootedApplications.add(target);

  const originalFetch: unknown = Reflect.get(globalThis, 'fetch');
  Reflect.set(globalThis, 'fetch', (): Promise<Response> => {
    return Promise.reject(
      inversion.getError({
        message: `[${SCOPE}] A request was made during the boot check | The check never reaches the network: stub the service that sends it, or pass it in skipBindings`,
      }),
    );
  });

  try {
    await target.start();

    const verification = inversion.BindingVerifier.assertResolve({
      container: target,
      namespaces: VERIFIED_NAMESPACES,
      skip: skipBindings,
      scope: SCOPE,
    });

    const { i18nProvider } = ApplicationProviders.resolve({ container: target });
    const features = Features.read({ container: target });
    Features.mount({ features });
    await Features.loadMessages({ features, i18nProvider, locale });

    // A skip that matched is a binding that exists: the core rejects one that matched nothing.
    const hasBindings = verification.verified.length > 0 || (skipBindings?.length ?? 0) > 0;

    if (!allowEmpty && !hasBindings && features.length === 0) {
      fail(
        'The application bound no service, repository, datasource, component, configuration or feature | Nothing was checked: the artifact index is probably empty. Pass { allowEmpty: true } if that is intended',
      );
    }
  } finally {
    Reflect.set(globalThis, 'fetch', originalFetch);
  }

  return target;
};

/**
 * A `ResizeObserver` for a test host whose own `observe()` does nothing, such as happy-dom. Call
 * `FakeResizeObserver.install()` before the code under test creates its observer, and `flush` to
 * deliver a size. A callback runs at once; code that waits for an animation frame still needs the
 * test's own frame control.
 */
export class FakeResizeObserver implements ResizeObserver {
  private static readonly all = new Set<FakeResizeObserver>();

  private readonly targets = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.all.add(this);
  }

  /** Replaces `globalThis.ResizeObserver` with the fake. The returned function puts the previous one back. */
  static install(): () => void {
    const previous = globalThis.ResizeObserver;
    FakeResizeObserver.all.clear();
    globalThis.ResizeObserver = FakeResizeObserver;

    return () => {
      globalThis.ResizeObserver = previous;
    };
  }

  /** Calls every observer of `element` with one entry of that size, for the content and the border box alike. */
  static flush(opts: { element: Element; width: number; height: number }): void {
    const { element, width, height } = opts;
    const box = { x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height };
    const size = [{ inlineSize: width, blockSize: height }];
    const entry: ResizeObserverEntry = {
      target: element,
      contentRect: { ...box, toJSON: () => box },
      contentBoxSize: size,
      borderBoxSize: size,
      devicePixelContentBoxSize: [],
    };

    for (const observer of FakeResizeObserver.all) {
      if (observer.targets.has(element)) {
        observer.callback([entry], observer);
      }
    }
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }
}
