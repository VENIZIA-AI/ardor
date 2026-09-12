---
type: Reference
title: Key source files
description: A per-concern map of the ARDOR monorepo pointing to the files an agent should open first.
resource: packages/kernel/src/index.ts
tags: [reference, source-map, navigation]
---

Use this as the fast-lookup index before grepping the whole repo. It groups files by concern, not by package, so an agent chasing a behavior knows exactly where to look first.

## Application lifecycle and bootstrap
- `packages/kernel/src/base/applications/abstract.ts` - the abstract application base class, the core of [Application lifecycle](/architecture/application-lifecycle.md).
- `packages/kernel/src/base/applications/index.ts` - application exports.
- `packages/react/src/contexts/application.ts` and `packages/react/src/hooks/use-application-context.ts` - how React consumes the running application instance, see [Hooks and context](/architecture/hooks-and-context.md).
- `packages/admin/src/components/application.tsx` - the react-admin `Application` component wiring the app into a rendered UI.

## Dependency injection
- `packages/kernel/src/base/decorators/api.ts` and `packages/kernel/src/base/decorators/index.ts` - the decorator API used for binding and injection, core to [DI in the browser](/architecture/di-in-the-browser.md).
- `packages/kernel/src/common/keys.ts` - the binding key constants, see [Binding keys](/reference/binding-keys.md) and [Binding key namespaces](/conventions/binding-key-namespaces.md).
- `packages/react/src/hooks/use-injectable.ts` - the hook that resolves bindings inside React components.

## Providers and data flow
- `packages/kernel/src/base/providers/base.ts` and `packages/kernel/src/base/providers/index.ts` - base provider contracts.
- `packages/admin/src/providers/rest-data.ts`, `packages/admin/src/providers/count-rest-data.ts` - the data provider pipeline implementations, see [Data provider pipeline](/architecture/data-provider-pipeline.md) and [Providers](/reference/providers.md).
- `packages/admin/src/providers/auth.ts` - the auth provider, tied to [Auth recovery](/architecture/auth-recovery.md) and [No-auth paths](/architecture/no-auth-paths.md).
- `packages/admin/src/providers/i18n.ts` - the i18n provider, see [i18n](/architecture/i18n.md).
- `packages/admin/src/providers/index.ts` - provider exports.

## Services
- `packages/kernel/src/base/services/base.ts`, `api.ts`, `auth.ts`, `network-request.ts` - the kernel service layer: base service class, API service, auth service, network request wrapper.
- `packages/admin/src/services/crud.ts` and `packages/admin/src/services/index.ts` - CRUD service used by data providers.
- See [Hooks and services](/reference/hooks-and-services.md) for the full inventory.

## Networking
- `packages/kernel/src/helpers/networks/base-request.ts` - shared request logic.
- `packages/kernel/src/helpers/networks/fetchers/abstract.ts`, `axios.ts`, `node-fetch.ts` - swappable fetcher implementations.
- `packages/kernel/src/helpers/networks/common/types.ts` - shared network types, relevant to [Header protocol](/architecture/header-protocol.md).
- `packages/kernel/src/helpers/socket-io-client.ts` - socket client helper.

## Error handling
- `packages/admin/src/hooks/use-notify-error.ts` - the hook surfacing errors to the UI, see [Error flow](/architecture/error-flow.md) and [Error handling](/conventions/error-handling.md).

## Auth-adjacent hooks
- `packages/admin/src/hooks/use-refresh-token.ts` - token refresh logic feeding [Auth recovery](/architecture/auth-recovery.md).
- `packages/admin/src/hooks/use-request-header-locale.ts` - locale propagation on requests, ties into [Header protocol](/architecture/header-protocol.md) and [i18n](/architecture/i18n.md).

## i18n
- `packages/admin/src/common/locales/en.ts`, `vi.ts`, `index.ts` - locale bundles.
- `packages/admin/src/hooks/use-translate.ts` - the translation hook.

## React hooks (generic, non-admin)
- `packages/react/src/hooks/` - `use-autosave.ts`, `use-before-unload.ts`, `use-confirm.ts`, `use-copy-to-clipboard.ts`, `use-debounce.ts`, `use-sizer.ts`, `use-window-dimensions.ts`, and `redux/use-app-dispatch.ts` / `redux/use-app-selector.ts`. See [React hooks conventions](/conventions/react-hooks.md).

## Utilities
- `packages/kernel/src/utilities/boolean.ts`, `file.ts`, `parse.ts`, `url.ts` - small pure helpers used throughout the kernel.
- `packages/kernel/src/helpers/base-helper.ts` and `logger.ts` - shared helper base and logging.

## UI kit
- `packages/ui-kit/src/components/shadcn/` - the full set of shadcn-based primitives (button, dialog, sidebar, table, etc), the visual building blocks referenced by [ui-kit package](/packages/ui-kit.md).
- `packages/ui-kit/src/components/core/` - adaptive dialog/popover, backdrop, inputs (checkbox, date-picker, switch, text-field).
- `packages/ui-kit/src/generate-index.ts` - script generating the package's barrel export, relevant to [Public surface](/reference/public-surface.md).

## Package entry points
- `packages/kernel/src/index.ts`, `packages/react/src/index.ts`, `packages/admin/src/index.ts`, `packages/ardor/src/index.ts`, `packages/ui-kit/src/index.ts` - always check these first since they define what each package actually exports publicly. Cross-reference with [Kernel package](/packages/kernel.md), [React package](/packages/react.md), [Admin package](/packages/admin.md), [ARDOR package](/packages/ardor.md), and [ui-kit package](/packages/ui-kit.md).

## Types and constants
- `packages/kernel/src/common/types.ts`, `constants.ts` - shared kernel-wide types and constants.
- `packages/react/src/common/types.ts` and `packages/admin/src/common/types.ts` - package-level shared types.

For a narrower answer to "which file defines X", start at the package entry point, then follow its re-exports down into the concern-specific file listed above rather than searching blind.
