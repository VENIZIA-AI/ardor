---
title: AnyType and AnyObject are removed, and the stored user is typed
description: AnyType and AnyObject are gone from ARDOR, as they are from IGNIS; getUser and the session hooks use IAuthUser instead of any, and getIdentity resolves an id.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
migration:
  - id: remove-any-aliases
    symbols: [AnyType, AnyObject]
    upgrade:
      before: |-
        import type { AnyObject, AnyType } from '@venizia/ardor';
        const read = (value: AnyType) => value.name.toUpperCase();
        const bag: AnyObject = { page: 1 };
        const repository: HttpRepository<IProduct, AnyType> = products;
        const slot: TClass<HttpRepository<TNamedEntity, AnyType>> = OrganizerRepository;
      after: |-
        const read = (value: { name: string }) => value.name.toUpperCase();
        const bag: Record<string, unknown> = { page: 1 };
        const repository: HttpRepository<IProduct> = products;
        const slot: TClass<Pick<HttpRepository<TNamedEntity>, 'find' | 'count'>> = OrganizerRepository;
    downgrade:
      steps:
        - Pin the four ARDOR packages to 0.4.8-15 or earlier, with the IGNIS packages of that release, where AnyType and AnyObject exist, and undo the replacements.
        - To stay on the new ARDOR, declare the two names in your own code. AnyType is the any type; AnyObject is a Record of string, symbol and number keys whose values are any.
    data: Nothing stored changes. If the project uses @venizia/dev-configs, the IGNIS codemod rewrites the imports of both names, from @venizia/ardor and @venizia/ardor-kernel too. `bun run devz codemod any-aliases --all` is a dry run that only reports, and `bun run devz codemod any-aliases --write --all` applies it; replace by hand what it lists. The second type argument of HttpRepository is the payload type, which must extend object; leave it out for Partial of the entity, because unknown is rejected. A slot typed TClass of HttpRepository of one entity does not accept the repository class of another entity under the IGNIS TClass that ships with this release, with or without the AnyType argument; type the slot on the members the code calls, or make the code that takes it generic over the entity.
  - id: typed-do-request-query
    symbols: [DefaultNetworkRequestService.doRequest]
    upgrade:
      before: |-
        await networkService.doRequest({ type, method, paths, query: listOptions });
      after: |-
        await networkService.doRequest({ type, method, paths, query: { ...listOptions } });
    downgrade:
      steps:
        - Pin the four ARDOR packages to 0.4.8-15 or earlier, where the query of doRequest is any.
    data: Nothing stored changes. The query is sent as it was.
  - id: typed-stored-user
    symbols: [DefaultAuthService.getUser, DefaultAuthProvider.onSessionStarted, DefaultAuthProvider.getIdentity, IAuthUser]
    upgrade:
      before: |-
        const tenant = authService.getUser().tenant.toUpperCase();
      after: |-
        const user = authService.getUser();
        const label = 'tenant' in user && typeof user.tenant === 'string' ? user.tenant.toUpperCase() : '';
    downgrade:
      steps:
        - Pin the four ARDOR packages to 0.4.8-15 or earlier, where getUser returns any and onSessionStarted takes user as any.
        - Remove the id that getIdentity now adds from any test that compares its result with toEqual.
    data: The identity in localStorage has the same shape before and after. A stored identity whose userId or referenceId is not a string or a number, or whose username or provider is not a string, now reads as an empty object; saveAuth never writes one.
  - id: typed-user-override
    symbols: [DefaultAuthService.getUser]
    upgrade:
      before: |-
        override getUser(): { userId: string | null; role: string } {
          return { userId: null, role: 'admin' };
        }
      after: |-
        override getUser(): { userId: string; role: string } {
          return { userId: 'u-1', role: 'admin' };
        }
    downgrade:
      steps:
        - Pin the four ARDOR packages to 0.4.8-15 or earlier, where getUser returns any and an override may return any shape.
    data: An override of getUser, or a stub of the auth service, must return fields that fit IAuthUser. userId and referenceId are a string or a number, and username and provider are a string; extra fields and an interface of your own are fine. TypeScript reports TS2416 on the override, and TS2345 where the stub is passed as DefaultAuthService. An override that returns a plain object type with a tenant string field compiled before, as getUser returned any, and now fails with TS2416, so return an interface that extends IAuthUser and adds the field.
  - id: typed-user-id
    symbols: [DefaultAuthService.getUser, DefaultAuthProvider.getIdentity, IAuthUser]
    upgrade:
      before: |-
        setViewer(authService.getUser().userId);
        setViewer(identity.id);
      after: |-
        const { userId } = authService.getUser();
        if (userId !== undefined) {
          setViewer(String(userId));
        }
        setViewer(String(identity.id));
    downgrade:
      steps:
        - Pin the four ARDOR packages to 0.4.8-15 or earlier, where the user id is any.
    data: The user id is a string or a number (IdType), and absent when nothing is stored. A function that takes a string needs the value converted. In a test, expect(getUser()).toEqual with a key that is not on IAuthUser fails with TS2769; use toMatchObject, or expect with unknown as the type argument.
  - id: typed-list-params
    symbols: [DefaultRestDataProvider.getList, DefaultRestDataProvider.getManyReference, ICustomParams]
    upgrade:
      before: |-
        override async getList<RecordType extends RaRecord = RaRecord>(opts: {
          resource: string;
          params: GetListParams & QueryFunctionContext;
        }) {
          return super.getList<RecordType>(opts);
        }
      after: |-
        override async getList<RecordType extends RaRecord = RaRecord>(opts: {
          resource: string;
          params: GetListParams & QueryFunctionContext;
        }) {
          return super.getList<RecordType>({ resource: opts.resource, params: { ...opts.params } });
        }
    downgrade:
      steps:
        - Pin the four ARDOR packages to 0.4.8-15 or earlier, where the index signature of ICustomParams is any and an interface fits it.
    data: Nothing stored changes. ICustomParams has an index signature of unknown, not any, and the params of getList and getManyReference must have one, because a react-admin params type is an interface, so an override that passes it to super spreads it. getOne and getMany no longer ask for ICustomParams, so an override of them that calls super needs no change. TypeScript reports TS2345 on the call to super.
---

# Changelog - 2026-11-15

## AnyType and AnyObject are removed, and the stored user is typed

<Badge type="warning" text="Breaking Change" />

**In one line.** `AnyType` and `AnyObject` are no longer exported by `@venizia/ardor-kernel` or `@venizia/ardor`, because IGNIS removed them. `getUser()` and the `user` of `onSessionStarted` are now `IAuthUser`, not `any`, `getIdentity` resolves an `id`, and the `query` of `doRequest` is `Record<string, unknown>`.

```diff
-import type { AnyObject, AnyType } from '@venizia/ardor';
-
-const read = (value: AnyType) => value.name.toUpperCase();
-const bag: AnyObject = { page: 1 };
+const read = (value: { name: string }) => value.name.toUpperCase();
+const bag: Record<string, unknown> = { page: 1 };

-const tenant = authService.getUser().tenant.toUpperCase();
+const user = authService.getUser();
+const label = 'tenant' in user && typeof user.tenant === 'string' ? user.tenant.toUpperCase() : '';
```

## What changed

- **`AnyType` and `AnyObject` are gone.** ARDOR re-exported them from IGNIS and no longer can. Nothing replaces them under the same name. ARDOR's own code uses the type that says what the value is: `unknown` where a value is only passed on, `Record<string, unknown>` for a bag of keys, `ReadonlySet<unknown>` and `(...args: never[]) => unknown` in `TPaths`.
- **The `query` of `doRequest` is `Record<string, unknown>`.** It was `any`. An object literal or a `type` alias fits; an `interface` value does not (see the fifth step below).
- **`getUser()` returns `IAuthUser`.** The fields `saveAuth` stores (`userId`, `username`, `referenceId`, `provider`) have their types and are absent when nothing is stored; `IAuthUser` has no index signature, so a field you added yourself is not on the type until you check it with `in`, and an interface of your own with these fields fits it. `IAuthUser` is new in `@venizia/ardor-kernel` and `@venizia/ardor`.
- **A stored identity with a wrong field type is read as `{}`.** `getUser()` used to return any stored object. Now a `userId` or `referenceId` that is not a string or a number, or a `username` or `provider` that is not a string, makes it read as empty, as a stored array already did. `saveAuth` never writes that.
- **`onSessionStarted` takes `user: IAuthUser`.** A subclass that names a type that extends `IAuthUser` still overrides it (see below); a plain `{ tenant: string }` does not.
- **`getIdentity` resolves an `id`.** It resolves the stored user with `id` set to its `userId`, the field react-admin's `UserIdentity` requires; before, it resolved the stored fields only, and `useGetIdentity` returned no `id`.
- **`ICustomParams` has an index signature of `unknown`, not `any`.** `getList` and `getManyReference` take it; `getOne` and `getMany` do not, because they read no key besides `meta.filter`. A react-admin params type is an interface, which has no index signature, so an override that passes it to `super` spreads it (see below).
- **`TPaths` and `TFullPaths` give the same paths.** Only the types they test a value against changed.

## Who is affected

- **An app that imports `AnyType` or `AnyObject` from `@venizia/ardor` or `@venizia/ardor-kernel`.** TypeScript reports `has no exported member`. Replace each use as shown below.
- **An app that passes an `interface` value as the `query` of `doRequest`.** Spread it.
- **An app whose subclass overrides `getList` or `getManyReference` and passes react-admin's params to `super`.** Spread them.
- **An app that reads a field of `getUser()` other than the four above, or of the `user` of `onSessionStarted`, without a check.** It compiled because the type was `any`; now the field is not on the type.
- **An app that passes the user id, or the `id` of `getIdentity`, where a `string` is wanted.** The id is a string or a number.
- **An app with its own auth service, or a stub of it,** whose `getUser` returns a shape that does not fit `IAuthUser`.
- **An app that passes an `interface` value where it now writes `Record<string, unknown>`.** An interface has no index signature, so TypeScript rejects it. See the third case below.
- **An app whose test compares `getIdentity()` with `toEqual`** and the stored fields only: the result now has `id` too.
- **All other apps.** No action needed.

## Breaking changes

**1. Replace `AnyType` with the type the value has.** `unknown` when you only pass the value on, a named type when you read it, and `any` only where you mean it (you write it yourself). If the project uses `@venizia/dev-configs`, the IGNIS codemod rewrites the imports of both names, the ones from `@venizia/ardor` and `@venizia/ardor-kernel` too, and lists what it cannot. `bun run devz codemod any-aliases --all` is a dry run that only reports; `bun run devz codemod any-aliases --write --all` applies it. Replace what it lists by hand. With `value: unknown`, reading `value.name` fails with "'value' is of type 'unknown'".

```diff
-import type { AnyType } from '@venizia/ardor';
-const read = (value: AnyType) => value.name.toUpperCase();
+const read = (value: { name: string }) => value.name.toUpperCase();
```

A type argument is the same: `HttpRepository<IProduct, AnyType>` becomes `HttpRepository<IProduct>`. The second argument is the payload type, which must extend `object` and defaults to `Partial<IProduct>`; `unknown` is rejected ("Type 'unknown' does not satisfy the constraint 'object'").

```diff
-const repository: HttpRepository<IProduct, AnyType> = products;
+const repository: HttpRepository<IProduct> = products;
```

A class slot typed for one entity does not accept the repository class of another, which matters when one slot holds several repositories (`OrganizerRepository` extends `HttpRepository<TOrganizer>`, the slot is typed with `TNamedEntity`). The `AnyType` argument is not what made it compile: IGNIS's new `TClass` is `new (...args: never[]) => T`, where it was that type joined with an index signature of `any`, and with the new one even `HttpRepository<TNamedEntity, any>` is refused. TypeScript reports TS2322, "Type 'typeof OrganizerRepository' is not assignable to type 'TClass<HttpRepository<TNamedEntity, ...>>'", through `resolveFindFilter`. Type the slot on the members the code calls, or take the entity as a type parameter.

```ts
import type { TClass } from '@venizia/ignis-inversion';
import { HttpRepository } from '@venizia/ardor/repository';

type TNamedEntity = { id: string } & { name?: Record<string, string> };
type TOrganizer = { id: string; name: Record<string, string>; code: string };

export class OrganizerRepository extends HttpRepository<TOrganizer> {}

// The slot names the members the code calls.
export const slot: TClass<Pick<HttpRepository<TNamedEntity>, 'find' | 'count'>> = OrganizerRepository;

// Or the code that takes the slot is generic over the entity.
export const take = <E extends object>(repository: TClass<HttpRepository<E>>) => repository;
export const taken = take(OrganizerRepository);
```

**2. Replace `AnyObject` with `Record<string, unknown>`.** Reading a key now gives `unknown`; narrow it before you use it.

```diff
-import type { AnyObject } from '@venizia/ardor';
-const bag: AnyObject = { page: 1 };
-const next = bag.page + 1;
+const bag: Record<string, unknown> = { page: 1 };
+const next = typeof bag.page === 'number' ? bag.page + 1 : 1;
```

**3. An `interface` does not fit `Record<string, unknown>`.** `AnyObject` accepted it; `Record<string, unknown>` does not, because an interface has no index signature. TypeScript says "Index signature for type 'string' is missing in type 'IProduct'".

```diff
 interface IProduct {
   id: number;
   name: string;
 }
 declare const product: IProduct;
-const old: AnyObject = product;
+const bag: Record<string, unknown> = product;
```

The line with `+` does not compile. Any of these three does:

```ts
interface IProduct {
  id: number;
  name: string;
}
declare const product: IProduct;

// A copy is a plain object type, which has the index signature an interface lacks.
export const copy: Record<string, unknown> = { ...product };
// When you only need "an object".
export const anything: object = product;

// A `type` alias has the index signature too.
type TProduct = { id: number; name: string };
declare const aliased: TProduct;
export const bag: Record<string, unknown> = aliased;
```

**4. Read the fields of the stored user through `IAuthUser`.** A field you added yourself is not on the type: check it with `in` before you use it. TypeScript reports "Property 'tenant' does not exist on type 'IAuthUser'" for the old line.

```diff
-const tenant = authService.getUser().tenant.toUpperCase();
+const user = authService.getUser();
+const label = 'tenant' in user && typeof user.tenant === 'string' ? user.tenant.toUpperCase() : '';
```

The user id and the `id` of `getIdentity` are a string or a number, and the user id is absent when nothing is stored. Convert them where a `string` is wanted.

```diff
-setViewer(authService.getUser().userId);
-setViewer(identity.id);
+const { userId } = authService.getUser();
+if (userId !== undefined) {
+  setViewer(String(userId));
+}
+setViewer(String(identity.id));
```

An override of `getUser`, or a stub of the auth service, must return fields that fit `IAuthUser`: `userId` and `referenceId` a string or a number, `username` and `provider` a string. Extra fields, and an interface of your own, are fine. TypeScript reports TS2416 on the override, and TS2345 where the stub is passed as `DefaultAuthService`.

```diff
-override getUser(): { userId: string | null; role: string } {
-  return { userId: null, role: 'admin' };
+override getUser(): { userId: string; role: string } {
+  return { userId: 'u-1', role: 'admin' };
 }
```

An override that returns a plain `{ tenant: string }` fails the same way, because the type must extend `IAuthUser`. Return an interface that extends it (`IAppUser` is in step 7).

```diff
-override getUser(): { tenant: string } {
+override getUser(): IAppUser {
   return { tenant: 'acme' };
 }
```

In a test, `expect(getUser()).toEqual({ userId: 3, tenant: 'acme' })` fails with TS2769, because `toEqual` takes the type of the value and `tenant` is not on it. Use `toMatchObject`, or `expect<unknown>(getUser())`.

**5. Pass the query of `doRequest` as a plain object.** Its type was `any`; an `interface` value no longer fits, so spread it. TypeScript says "Index signature for type 'string' is missing in type 'IListOptions'".

```diff
-await networkService.doRequest({ type, method, paths, query: listOptions });
+await networkService.doRequest({ type, method, paths, query: { ...listOptions } });
```

**6. Spread react-admin's params when an override of `getList` or `getManyReference` calls `super`.** The params type is an interface and `ICustomParams` has an index signature; TypeScript reports TS2345. An override of `getOne` or `getMany` needs no change. `getManyReference` takes the same change as `getList`.

```diff
 import type { GetListParams, QueryFunctionContext, RaRecord } from 'ra-core';

 override async getList<RecordType extends RaRecord = RaRecord>(opts: {
   resource: string;
   params: GetListParams & QueryFunctionContext;
 }) {
-  return super.getList<RecordType>(opts);
+  return super.getList<RecordType>({ resource: opts.resource, params: { ...opts.params } });
 }
```

**7. Name your user type in a hook.** An interface that extends `IAuthUser` is the user the hook receives, and the override keeps compiling.

```ts
import { DefaultAuthProvider, type IAuthTokenRecord, type IAuthUser } from '@venizia/ardor';

interface IAppUser extends IAuthUser {
  tenant: string;
}

export class AppAuthProvider extends DefaultAuthProvider {
  protected override onSessionStarted(opts: { token: IAuthTokenRecord; user: IAppUser }) {
    this.logger.info('[onSessionStarted] tenant %s', opts.user.tenant);
  }
}
```

`IAppUser` is yours to trust: `getUser()` reads browser storage, so the extra fields are whatever your sign-in saved. Check them where a wrong value would do harm.

**8. Run `bun check`.** The errors name each use left. The `devz` codemod of step 1 rewrites the imports of the two names; the other replacements depend on the value, so there is no codemod for them.

## How to go back

Pin the four ARDOR packages to `0.4.7`, with the IGNIS packages of the 0.4.7 line, where `AnyType` and `AnyObject` exist, and undo steps 1 to 7. To stay on the new ARDOR and keep the old names, declare them in your own code: `AnyType` as the `any` type, and `AnyObject` as a `Record` of `string`, `symbol` and `number` keys whose values are `any`.

Nothing stored changes: the identity in `localStorage` has the same shape before and after.
