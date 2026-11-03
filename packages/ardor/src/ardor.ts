// Every ARDOR hook, gathered for `export * as Ardor` in index.ts: one name, `Ardor.useRepository(...)`,
// the way `React.useState` is one. Each member is the very function the react or admin package
// exports. The React Rules of Hooks recognise a call through a PascalCase identifier, so
// `Ardor.useX()` is checked like `useX()`. It sits in `@venizia/ardor` because react cannot import
// admin; the two packages keep their own top-level exports.
//
// A module namespace, not an object literal: a bundler resolves `Ardor.useRepository` to that one
// hook and drops the rest, where an object that lists them all would pull every hook in.
export {
  useDocumentTitle,
  useFeatures,
  useHtmlLang,
  useNotifyError,
  useRefreshToken,
  useRequestHeaderLocale,
  useTranslate,
} from '@venizia/ardor-admin';
export {
  useApplicationContext,
  useApplicationLogger,
  useAutosave,
  useBeforeUnload,
  useComponent,
  useConfiguration,
  useConfirm,
  useCopyToClipboard,
  useDebounce,
  useElementSize,
  useInjectable,
  useInjectableContainer,
  useProvider,
  useRepository,
  useService,
  useSizer,
  useStoredState,
  useWindowDimensions,
} from '@venizia/ardor-react';
