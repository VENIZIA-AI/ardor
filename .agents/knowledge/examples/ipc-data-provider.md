---
type: Tutorial
title: ipc-data-provider
description: Walks through moving ARDOR's data provider send() path onto a custom transport by overriding send(), using an in-process IPC example, and what still goes over HTTP.
resource: examples/ipc-data-provider/src/index.ts
tags: [tutorial, data-provider, ipc, transport, examples]
---

## What send() is the seam for

`send()` is the point where a resource name and a set of params turn into a network call and come
back as `{ data }`, for everything that calls it: `DefaultAuthProvider` (`login`, `checkAuth`),
`BaseCrudService`, and any direct `dataProvider.send()` call. Swap `send()` and those callers move
to the new transport without being touched. The base class, `DefaultRestDataProvider`, assumes HTTP
by default, but nothing about its public shape (`IDataProvider`) requires HTTP.

`send()` is **not** the seam for the react-admin CRUD methods (`getList`, `create`, ...): they reach
`networkService.doRequest` without going through `send()` (`getList` and `getManyReference` by way
of the overridable `getListHelper`), so with only `send()` overridden they still issue HTTP against
the bound `url` - see Step 3.

This example shows the `send()` seam by replacing HTTP under it with an in-memory command dispatch
table - the same shape a desktop shell would use for Tauri's `invoke`, an Electron bridge, or a
Worker port.

## Step 1: model the transport

Before touching ARDOR at all, model whatever channel you're bridging to. Here it's a `COMMANDS`
map keyed by resource name, each entry a function taking `ISendParams` and returning raw data. An
`invoke()` helper looks up the command and returns a `Promise<ISendResponse<TResponse>>`, rejecting
with a `{ message, statusCode }` shape if the command doesn't exist - matching the error shape the
rest of ARDOR expects, per [Error flow](/architecture/error-flow.md).

## Step 2: subclass IpcDataProvider

```ts
export class IpcDataProvider extends DefaultRestDataProvider {
  override send<TResponse = unknown>(opts: {
    resource: string;
    params: ISendParams;
  }): Promise<ISendResponse<TResponse>> {
    return invoke<TResponse>({ command: opts.resource, payload: opts.params });
  }
}
```

That's the entire override. No fetch, no headers, no URL construction. `resource` becomes the
command name; `params` is passed straight through.

## Step 3: what still comes from the base class

Everything else - but inherited is not the same as transport-agnostic. The CRUD methods (`getList`,
`getOne`, `create`, `update`, `delete`, ...) and their filter-to-query mapping are inherited
unchanged, and they still go through `networkService.doRequest` over HTTP; here that means against
`ipc://local`, which fails. A shell with no HTTP at all must override those methods too (or swap the
network service), following the same pattern: keep the public shape, replace only what differs.
`value()`, the positional adapter react-admin actually holds, is inherited too - see
[Data provider pipeline](/architecture/data-provider-pipeline.md).

## Step 4: bind it

The kernel's DI container (see [DI in the browser](/architecture/di-in-the-browser.md)) still needs
provider options bound, even though the URL is never dereferenced by `send()`:

```ts
bindContext(): void {
  this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
    url: 'ipc://local',
    useAuth: false,
  });
  this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(IpcDataProvider);
}
```

`toProvider` binds the class itself so the container can construct it with its dependencies
resolved, following [Binding key namespaces](/conventions/binding-key-namespaces.md) conventions for
`CoreBindings`. `useAuth: false` opts out of the auth pipeline entirely -
see [No-auth paths](/architecture/no-auth-paths.md) - since this example has no session concept.

## Step 5: run it

```bash
cd examples/ipc-data-provider
bun run start
```

The script builds a minimal `BaseArdorApplication`, starts it (triggering the normal
[Application lifecycle](/architecture/application-lifecycle.md)), then pulls the provider back out
of the container with `application.get()` and calls `send({ resource, params })` - ARDOR's
object-shaped escape hatch, not a positional react-admin method. It exercises `send()` alone: a
`products` list fetch, a single `products` fetch by id, and an `auth/login` POST. Each comes
back as ordinary ARDOR provider output - same shape as if it had gone over HTTP. A call to an
unknown command rejects with a 404-shaped error, exercising the same error path a bad HTTP response
would trigger.

## Takeaway

To add a new transport to ARDOR: subclass the default provider, override `send()` - and, if the
transport has no HTTP, the CRUD methods as well, since they bypass `send()` - bind the subclass in
`bindContext()`, and consume it through the same `IDataProvider` interface everywhere else. See
[Adding a provider](/process/adding-a-provider.md) for the general checklist and
[Providers reference](/reference/providers.md) for what ships today.
