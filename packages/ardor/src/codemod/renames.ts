/** A member of a class: `ValueUtility.isDefined` is `{ owner: 'ValueUtility', member: 'isDefined' }`. */
export interface IMemberTarget {
  owner: string;
  member: string;
}

/** The packages whose exports the codemod rewrites. Anything else with the same name is left alone. */
export class NamespaceModules {
  static readonly UMBRELLA = '@venizia/ardor';

  static readonly SCHEME_SET = new Set([
    NamespaceModules.UMBRELLA,
    '@venizia/ardor-kernel',
    '@venizia/ardor-react',
    '@venizia/ardor-admin',
  ]);

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

/**
 * The bare functions that became static members of a class (removed after 0.4.6). The class
 * is exported by the package that exported the function, so an import is rewritten in place.
 */
export class FunctionRenames {
  static readonly TARGETS: Readonly<Record<string, IMemberTarget>> = {
    isDefined: { owner: 'ValueUtility', member: 'isDefined' },
    isString: { owner: 'ValueUtility', member: 'isString' },
    isNumber: { owner: 'ValueUtility', member: 'isNumber' },
    isObject: { owner: 'ValueUtility', member: 'isObject' },
    isValidDate: { owner: 'ValueUtility', member: 'isValidDate' },
    isBrowser: { owner: 'BrowserUtility', member: 'isBrowser' },
    toDataUrl: { owner: 'FileUtility', member: 'toDataUrl' },
    getRuntimeConfig: { owner: 'RuntimeConfig', member: 'get' },
    createAppDispatch: { owner: 'DispatchHooks', member: 'create' },
    createAppSelectors: { owner: 'SelectorHooks', member: 'create' },
    resolveApplicationProviders: { owner: 'ApplicationProviders', member: 'resolve' },
    hasPendingFeatureMessages: { owner: 'Features', member: 'hasPendingMessages' },
    loadFeatureMessages: { owner: 'Features', member: 'loadMessages' },
  };

  static find(opts: { name: string }): IMemberTarget | undefined {
    return Object.hasOwn(this.TARGETS, opts.name) ? this.TARGETS[opts.name] : undefined;
  }
}

/** Every hook the `Ardor` namespace of `@venizia/ardor` holds. */
export class HookRenames {
  static readonly OWNER = 'Ardor';

  static readonly NAMES = new Set([
    'useApplicationContext',
    'useApplicationLogger',
    'useAutosave',
    'useBeforeUnload',
    'useComponent',
    'useConfiguration',
    'useConfirm',
    'useCopyToClipboard',
    'useDebounce',
    'useDocumentTitle',
    'useDocumentVisibility',
    'useElementSize',
    'useFeatures',
    'useHtmlLang',
    'useInjectable',
    'useInjectableContainer',
    'useIntersection',
    'useMediaQuery',
    'useNotifyError',
    'useOnlineStatus',
    'useProvider',
    'useRefreshToken',
    'useRepository',
    'useRequestHeaderLocale',
    'useResizeEffect',
    'useService',
    'useStoredState',
    'useTranslate',
    'useUntypedTranslate',
    'useWindowDimensions',
  ]);

  static find(opts: { name: string }): IMemberTarget | undefined {
    return this.NAMES.has(opts.name) ? { owner: this.OWNER, member: opts.name } : undefined;
  }
}

/** Types that became a plain type (removed after 0.4.6). The replacement is the exact old definition. */
export class TypeRenames {
  static readonly TARGETS: Readonly<Record<string, string>> = {
    NumberIdType: 'number',
    StringIdType: 'string',
    NullableType: 'undefined | null | void',
  };

  static find(opts: { name: string }): string | undefined {
    return Object.hasOwn(this.TARGETS, opts.name) ? this.TARGETS[opts.name] : undefined;
  }
}

/** Exports and members removed with no code the codemod can write in their place. */
export class RemovedNames {
  static readonly EXPORTS: Readonly<Record<string, string>> = {
    isEditableTarget: 'nothing in ARDOR called it; check the event target in your own code',
    TDataCount: 'nothing in ARDOR used it; declare the shape you need',
    ISyncFC: 'write the function type, (props: TProps) => ReactNode',
  };

  /** Class name to removed static member to the reason. */
  static readonly MEMBERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    App: { DEFAULT_LOCALE: 'nothing in ARDOR read it, and the i18n provider defaults to "en"' },
    HeaderConstants: {
      REQUEST_DEVICE_INFO: 'nothing in ARDOR sent or read this header',
      RESPONSE_FORMAT: 'nothing in ARDOR sent or read this header',
    },
  };

  static findExport(opts: { name: string }): string | undefined {
    return Object.hasOwn(this.EXPORTS, opts.name) ? this.EXPORTS[opts.name] : undefined;
  }

  static findMember(opts: { owner: string; member: string }): string | undefined {
    const members = Object.hasOwn(this.MEMBERS, opts.owner) ? this.MEMBERS[opts.owner] : undefined;

    return members && Object.hasOwn(members, opts.member) ? members[opts.member] : undefined;
  }
}

/** The kernel logger stack that IGNIS's browser-safe `core` entry replaces. */
export class LoggerRenames {
  static readonly CORE_MODULE = '@venizia/ignis-helpers/core';

  /** Same name, same shape, other package: only the import moves. */
  static readonly MOVED = new Set(['BaseHelper', 'LogLevels', 'ILogger', 'TLogLevel']);

  /** The class the kernel's `Logger` is replaced by in `Logger.getInstance(...)` and `new Logger(...)`: `LoggerFactory.getLogger([scope])`. */
  static readonly FACTORY = 'LoggerFactory';

  /** The type a `Logger` annotation becomes. */
  static readonly TYPE = 'ILogger';
}
