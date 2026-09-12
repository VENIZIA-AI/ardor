# Migrating from `@minimaltech/ra-core-infra` to ARDOR

`@minimaltech/ra-core-infra` became ARDOR. The code is the same code; it was split along its real
dependency seams and rebranded. Everything a consumer imported is still importable from one
specifier, so the bulk of the migration is a codemod.

> **`@minimaltech/ra-core-infra` is frozen at 0.0.3-18.** No further release will be cut from it.
> ARDOR is the only home for this code - a fix belongs in `packages/kernel`, `packages/react` or
> `packages/admin`, never in `aether/packages/ra-core-infra`. Export parity was verified against
> that final state: 146 exported symbols, all present in ARDOR under the same names except the
> four renames below and `DIContainer`, which was dropped.

## What ARDOR is

ARDOR is the frontend member of the VENIZIA family. IGNIS is the backend framework; ARDOR is a
consumer of IGNIS - it builds a frontend application on `@venizia/ignis-inversion` for inversion of
control and `@venizia/ignis-filter` for the query vocabulary the data layer speaks.

| Package | Role | Depends on |
|---|---|---|
| `@venizia/ardor-kernel` | Isomorphic core: application base, service and CRUD bases, request and auth constants, binding keys, logger, network fetchers, socket client. No React, no react-admin. | IGNIS inversion + filter |
| `@venizia/ardor-react` | The application context, the hooks that read it (`useInjectable`, `useApplicationContext`), the typed Redux hook factories, and the UI hooks (`useDebounce`, `useAutosave`, `useConfirm`, ...). No react-admin. | kernel, React |
| `@venizia/ardor-admin` | The react-admin adapter: REST data provider, auth provider, i18n provider, the `ArdorApplication` root component, `useTranslate`, `useNotifyError`, and the English and Vietnamese message bundles. | kernel, react, `ra-core` |
| `@venizia/ardor` | Umbrella. Re-exports all three, so an application needs one dependency and one import specifier. | the three above |
| `@venizia/ardor-ui-kit` | The design system (Tailwind + Radix components, design tokens). Unchanged by this migration. | React, Tailwind |

Install `@venizia/ardor` unless a package genuinely needs only one layer.

## Where the old code went

| `ra-core-infra` | ARDOR |
|---|---|
| `src/common/{constants,keys}.ts` | `@venizia/ardor-kernel` |
| `src/common/types.ts` | split: the pure types to `ardor-kernel`, the `ra-core` provider contracts (`IDataProvider`, `IAuthProvider`, `II18nProviderOptions`) to `ardor-admin` |
| `src/common/locales/{en,vi}.ts` | `@venizia/ardor-admin` |
| `src/helpers/**` (logger, networks, fetchers, socket client) | `@venizia/ardor-kernel` |
| `src/utilities/**` | `@venizia/ardor-kernel` |
| `src/base/applications`, `src/base/services`, `src/base/decorators` | `@venizia/ardor-kernel` |
| `src/base/services/base-crud.service.ts` | `@venizia/ardor-admin` - `BaseCrudService` is typed on the react-admin `IDataProvider` |
| `src/base/providers/base.provider.ts` | `@venizia/ardor-kernel` |
| `src/base/providers/{default-rest-data,count-rest-data,default-auth,default-i18n}` | `@venizia/ardor-admin` |
| `src/ui/{context,hooks}` (framework-agnostic hooks) | `@venizia/ardor-react` |
| `src/ui/hooks/{use-translate,use-notify-error,use-refresh-token,use-request-header-locale}` | `@venizia/ardor-admin` - each one calls a `ra-core` hook |
| `src/ui/components/CoreRaApplication.tsx` | `@venizia/ardor-admin` as `ArdorApplication` |

File names follow the family convention - named by role, never repeating the folder - so
`helpers/logger.helper.ts` is now `helpers/logger.ts` and `providers/default-rest-data.provider.ts`
is now `providers/rest-data.ts`. This is invisible to consumers, which import from the barrel.

## Breaking changes

There are exactly four renames. Every other exported symbol keeps its name.

| Before | After |
|---|---|
| `AbstractRaApplication` | `AbstractArdorApplication` |
| `BaseRaApplication` | `BaseArdorApplication` |
| `CoreRaApplication` | `ArdorApplication` |
| `ICoreRaApplication` | `IArdorApplication` |

Two removals and one requirement:

- **`DIContainer` is gone.** It was a second, weaker container beside the IGNIS one. Use the
  inversion `Container` the application already is.
- **Module augmentation moves to the declaring package.** A TypeScript interface merges only into
  the module that declares it, never through a re-export, so augmenting `@venizia/ardor` would
  silently do nothing. Augment the owner instead:

  ```typescript
  // IUseInjectableKeysOverrides is declared in @venizia/ardor-react
  declare module '@venizia/ardor-react' {
    interface IUseInjectableKeysOverrides extends Record<keyof ReturnType<Application['bindingList']>, unknown> {}
  }

  // IUseTranslateKeysOverrides is declared in @venizia/ardor-admin
  declare module '@venizia/ardor-admin' {
    interface IUseTranslateKeysOverrides extends ITranslateKeys {}
  }
  ```

  The hooks themselves are still imported from `@venizia/ardor`; only the `declare module` target
  changes. The codemod rewrites these blocks.

- **`@venizia/ignis-inversion` must be `>=0.2.0-7`.** ARDOR resolves a binding from a class through
  the metadata registry (`useInjectable({ target })`), which the 0.1 line does not expose.

One bug fix worth knowing about, because it changes behavior:

- `Logger.toggleDebug({ state: false })` now disables debug logging. It previously fell through to
  a toggle, so asking it to turn debug off could turn it on.

## Running the codemod

From the consumer repository root:

```bash
bun /path/to/ardor/scripts/migrate-ra-core-infra.ts            # dry run, prints the plan
bun /path/to/ardor/scripts/migrate-ra-core-infra.ts --apply    # writes it
```

It performs four transforms and reports a count per transform:

1. the import specifier `@minimaltech/ra-core-infra` -> `@venizia/ardor`
2. the four renames above
3. `declare module` blocks retargeted to `@venizia/ardor-react` / `@venizia/ardor-admin`
4. the dependency entry in every `package.json`

It warns about any remaining `DIContainer` reference and about an augmented interface it does not
recognise. It writes nothing without `--apply`.

## After the codemod

1. Bump `@venizia/ignis-inversion` to `>=0.2.0-7` wherever the consumer pins it (a Bun catalog
   entry, or each `package.json`).
2. Install, then type-check. The type checker is what catches anything a text transform cannot see.
3. If the consumer ships its own Vietnamese message bundle, note that `ra-core` 5.15.3 requires
   `ra.validation.unique`; ARDOR's bundled `vietnameseMessages` now provides it.

## Retiring the old package

Once every consumer is on ARDOR, close the old package out so nobody installs it by accident:

```bash
npm deprecate '@minimaltech/ra-core-infra' 'Moved to @venizia/ardor - see https://github.com/VENIZIA-AI/ardor/blob/develop/docs/migration/ra-core-infra.md'
```

`scripts/migrate-ra-core-infra.ts` and this guide can be deleted in the same change - they exist
only to carry consumers across, and nothing in ARDOR depends on them.
