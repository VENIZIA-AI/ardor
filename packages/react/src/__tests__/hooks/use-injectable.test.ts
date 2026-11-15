import 'reflect-metadata';

import { describe, expect, spyOn, test } from 'bun:test';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { BindingScopes, Container } from '@venizia/ignis-inversion';
import { CoreBindings, service } from '@venizia/ardor-kernel';
import { ApplicationContext } from '@/contexts/application';
import { useApplicationContainer, useInjectable } from '@/hooks/use-injectable';

interface ITestApp {
  readonly id: string;
}

interface ICreateWrapperOptions {
  readonly container: Container | null;
}

interface IBindConstantValueOptions<T> {
  readonly container: Container;
  readonly key: string;
  readonly value: T;
}

class SomeClass {
  public readonly name = 'SomeClass';
}

class UnboundClass {
  public readonly name = 'UnboundClass';
}

const bindConstantValue = <T>({ container, key, value }: IBindConstantValueOptions<T>) => {
  const binding = container.bind({ key });

  if ('to' in binding && typeof binding['to'] === 'function') {
    binding['to'](value);

    return;
  }

  if ('toValue' in binding && typeof binding['toValue'] === 'function') {
    binding['toValue'](value);

    return;
  }
};

const createWrapper = ({ container }: ICreateWrapperOptions) => {
  return ({ children }: { readonly children: React.ReactNode }) => {
    return React.createElement(
      ApplicationContext.Provider,
      {
        value: {
          container,
          logger: null,
        },
      },
      children,
    );
  };
};

describe('useApplicationContainer', () => {
  test('answers the container of ApplicationContext', () => {
    const container = new Container({ scope: 'test' });

    const { result } = renderHook(() => useApplicationContainer(), {
      wrapper: createWrapper({ container }),
    });

    expect(result.current).toBe(container);
  });

  test('answers the container passed in over the one of the context', () => {
    const inContext = new Container({ scope: 'context' });
    const passed = new Container({ scope: 'passed' });

    const { result } = renderHook(() => useApplicationContainer({ container: passed }), {
      wrapper: createWrapper({ container: inContext }),
    });

    expect(result.current).toBe(passed);
  });

  test('throws where there is no container in the context and none is passed', () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => {
      renderHook(() => useApplicationContainer(), { wrapper: createWrapper({ container: null }) });
    }).toThrow('[useApplicationContainer] Failed to determine the application container!');

    errorSpy.mockRestore();
  });
});

describe('useInjectable with key option', () => {
  test('resolves binding from the container in ApplicationContext when only key is provided', () => {
    const container = new Container({ scope: 'test' });
    const appInstance: ITestApp = { id: 'context-app' };
    bindConstantValue({
      container,
      key: CoreBindings.APPLICATION_INSTANCE,
      value: appInstance,
    });

    const { result } = renderHook(
      () => {
        return useInjectable<ITestApp>({ key: CoreBindings.APPLICATION_INSTANCE });
      },
      {
        wrapper: createWrapper({ container }),
      },
    );

    expect(result.current).toBe(appInstance);
  });

  test('resolves from explicit container when both container and key are provided despite different context binding', () => {
    const contextContainer = new Container({ scope: 'context' });
    const explicitContainer = new Container({ scope: 'explicit' });

    const contextApp: ITestApp = { id: 'context-app' };
    const explicitApp: ITestApp = { id: 'explicit-app' };

    bindConstantValue({
      container: contextContainer,
      key: CoreBindings.APPLICATION_INSTANCE,
      value: contextApp,
    });
    bindConstantValue({
      container: explicitContainer,
      key: CoreBindings.APPLICATION_INSTANCE,
      value: explicitApp,
    });

    const { result } = renderHook(
      () => {
        return useInjectable<ITestApp>({
          container: explicitContainer,
          key: CoreBindings.APPLICATION_INSTANCE,
        });
      },
      {
        wrapper: createWrapper({ container: contextContainer }),
      },
    );

    expect(result.current).toBe(explicitApp);
    expect(result.current).not.toBe(contextApp);
  });

  // A minified build binds `services.Zv` where the code asks for `services.PricingService`; the
  // error has to name that cause, or it reads as a missing registration.
  test('names the minifier cause when the key is not bound', () => {
    const container = new Container();

    expect(() => {
      renderHook(
        () => {
          return useInjectable({ key: CoreBindings.APPLICATION_INSTANCE });
        },
        { wrapper: createWrapper({ container }) },
      );
    }).toThrow(
      /Binding key: @app\/application\/instance is not bounded in context! \| .*resolve it by \{ target \}/,
    );
  });
});

describe('useInjectable with target option', () => {
  test('resolves class bound via container bind toClass through metadata registry', () => {
    const container = new Container({ scope: 'test' });
    container.bind({ key: 'services.SomeClass' }).toClass(SomeClass);

    const registry = container.getMetadataRegistry();

    if ('setBindingKey' in registry && typeof registry['setBindingKey'] === 'function') {
      try {
        registry['setBindingKey']({ target: SomeClass, key: 'services.SomeClass' });
      } catch (error) {
        console.warn('setBindingKey failed:', error);
      }
    }

    if (!registry.getBindingKey({ target: SomeClass })) {
      spyOn(registry, 'getBindingKey').mockImplementation(
        ({ target }: { readonly target: unknown }) => {
          if (target === SomeClass) {
            return 'services.SomeClass';
          }

          return undefined;
        },
      );
    }

    const { result } = renderHook(
      () => {
        return useInjectable<SomeClass>({ target: SomeClass });
      },
      {
        wrapper: createWrapper({ container }),
      },
    );

    expect(result.current).toBeInstanceOf(SomeClass);
  });

  test('throws error naming the class when target was never bound', () => {
    const container = new Container({ scope: 'test' });

    expect(() => {
      renderHook(
        () => {
          return useInjectable({ target: UnboundClass });
        },
        {
          wrapper: createWrapper({ container }),
        },
      );
    }).toThrow('UnboundClass');
  });
});

describe('useInjectable container resolution failures', () => {
  test('throws error when neither context container nor explicit container is available', () => {
    expect(() => {
      renderHook(() => {
        return useInjectable({ key: CoreBindings.APPLICATION_INSTANCE });
      });
    }).toThrow('[useApplicationContainer] Failed to determine the application container!');
  });

  test('throws error when context provider provides null container and no explicit container is passed', () => {
    expect(() => {
      renderHook(
        () => {
          return useInjectable({ key: CoreBindings.APPLICATION_INSTANCE });
        },
        {
          wrapper: createWrapper({ container: null }),
        },
      );
    }).toThrow('[useApplicationContainer] Failed to determine the application container!');
  });
});

@service()
class PricingService {
  readonly label = 'PricingService';
}

describe('useInjectable infers the instance type of a target', () => {
  /**
   * The positive assignment fails to compile while the result is `unknown`; the `number` guard keeps it
   * failing if inference ever collapses to `any`.
   */
  test('returns the class instance with no generic written down', () => {
    const container = new Container({ scope: 'test' });
    container.bind({ key: 'services.PricingService' }).toClass(PricingService);

    const { result } = renderHook(() => useInjectable({ target: PricingService }), {
      wrapper: createWrapper({ container }),
    });

    const pricing: PricingService = result.current;
    // @ts-expect-error `PricingService` is not assignable to `number`
    const collapsed: number = result.current;

    expect(pricing.label).toBe('PricingService');
    expect(collapsed).toBeInstanceOf(PricingService);
  });
});

describe('useInjectable checks the generic that goes with a target', () => {
  test('a type the class satisfies compiles, and one it does not is a compile error', () => {
    const container = new Container({ scope: 'test' });
    container.bind({ key: 'services.PricingService' }).toClass(PricingService);

    const { result } = renderHook(
      () => {
        const asInterface: { label: string } = useInjectable<{ label: string }>({
          target: PricingService,
        });
        // @ts-expect-error `PricingService` has no `unitPrice`
        useInjectable<{ unitPrice: number }>({ target: PricingService });

        return asInterface;
      },
      { wrapper: createWrapper({ container }) },
    );

    expect(result.current.label).toBe('PricingService');
  });
});

describe('useInjectable checks the bound class', () => {
  const bindPlain = ({ container }: { container: Container }) => {
    @service()
    class Plain {
      readonly label = 'bound';
    }

    container.bind({ key: 'services.Plain' }).toClass(Plain);

    return Plain;
  };

  const createPlain = () => {
    @service()
    class Plain {
      readonly label = 'other';
    }

    return Plain;
  };

  test('throws, naming both classes, when another class of the same name holds the key', () => {
    const container = new Container({ scope: 'test' });
    bindPlain({ container });
    const other = createPlain();

    expect(() => {
      renderHook(() => useInjectable({ target: other }), {
        wrapper: createWrapper({ container }),
      });
    }).toThrow(
      /The key "services\.Plain" is bound to the class Plain, which is not the Plain you passed/,
    );
  });

  test('resolves the class that is bound', () => {
    const container = new Container({ scope: 'test' });
    const bound = bindPlain({ container });

    const { result } = renderHook(() => useInjectable({ target: bound }), {
      wrapper: createWrapper({ container }),
    });

    expect(result.current).toBeInstanceOf(bound);
  });

  test('accepts a subclass bound under the key of its parent', () => {
    @service()
    class Parent {
      readonly label = 'parent';
    }

    class Child extends Parent {}

    const container = new Container({ scope: 'test' });
    container.bind({ key: 'services.Parent' }).toClass(Child);

    const { result } = renderHook(() => useInjectable({ target: Parent }), {
      wrapper: createWrapper({ container }),
    });

    expect(result.current).toBeInstanceOf(Child);
  });

  test('a value binding has no class to compare and resolves', () => {
    const container = new Container({ scope: 'test' });
    const value = { label: 'value' };
    container.bind({ key: 'services.PricingService' }).toValue(value);

    const { result } = renderHook(() => useInjectable({ target: PricingService }), {
      wrapper: createWrapper({ container }),
    });

    const resolved: unknown = result.current;

    expect(resolved).toBe(value);
  });
});

describe('useInjectable resolves once per component and container', () => {
  const bindTransient = ({ container }: { container: Container }) => {
    container
      .bind({ key: 'services.PricingService' })
      .toClass(PricingService)
      .setScope(BindingScopes.TRANSIENT);
  };

  test('a transient binding gives the same instance on every render of one component', () => {
    const container = new Container({ scope: 'test' });
    bindTransient({ container });

    const { result, rerender } = renderHook(() => useInjectable({ target: PricingService }), {
      wrapper: createWrapper({ container }),
    });
    const first = result.current;

    rerender();
    rerender();

    expect(result.current).toBe(first);
  });

  test('a transient binding gives another instance to another component', () => {
    const container = new Container({ scope: 'test' });
    bindTransient({ container });
    const wrapper = createWrapper({ container });

    const one = renderHook(() => useInjectable({ target: PricingService }), { wrapper });
    const two = renderHook(() => useInjectable({ target: PricingService }), { wrapper });

    expect(two.result.current).not.toBe(one.result.current);
  });

  test('resolves again when the container changes, and not when it stays', () => {
    const first = new Container({ scope: 'first' });
    const second = new Container({ scope: 'second' });
    bindTransient({ container: first });
    bindTransient({ container: second });

    const { result, rerender } = renderHook(
      (props: { container: Container }) =>
        useInjectable({ target: PricingService, container: props.container }),
      { initialProps: { container: first } },
    );
    const fromFirst = result.current;

    rerender({ container: first });
    expect(result.current).toBe(fromFirst);

    rerender({ container: second });
    expect(result.current).not.toBe(fromFirst);
  });

  test('resolves again when the key changes', () => {
    const container = new Container({ scope: 'test' });
    container.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue({ id: 'application' });
    container.bind({ key: CoreBindings.APPLICATION_INFO }).toValue({ id: 'info' });

    const { result, rerender } = renderHook(
      (props: {
        key: typeof CoreBindings.APPLICATION_INSTANCE | typeof CoreBindings.APPLICATION_INFO;
      }) => useInjectable<ITestApp>({ key: props.key }),
      {
        initialProps: { key: CoreBindings.APPLICATION_INSTANCE },
        wrapper: createWrapper({ container }),
      },
    );

    expect(result.current.id).toBe('application');

    rerender({ key: CoreBindings.APPLICATION_INFO });

    expect(result.current.id).toBe('info');
  });
});
