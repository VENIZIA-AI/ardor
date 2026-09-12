---
type: Tutorial
title: ipc-data-provider
description: Walks through building a custom transport for ARDOR's data provider by overriding only send(), using an in-process IPC example.
resource: examples/ipc-data-provider/index.ts
tags: [tutorial, data-provider, ipc, transport, examples]
---

## Why send() is the seam

Every data provider in ARDOR eventually funnels through one method: `send()`. It is the single
point where a resource name and a set of params turn into a network call and come back as
`{ data }`. Everything above that - the react-admin methods (`getList`, `getOne`, `create`, and so
on), filter mapping, and the `value()` helper - is transport-agnostic and lives in the base class,
`DefaultRestDataProvider`. That base class assumes HTTP by default, but nothing about its public
shape (`IDataProvider`) requires HTTP. This is the extension point described in
[Data provider pipeline](/architecture/data-provider-pipeline.md): swap `send()` and you swap the
whole transport without touching a single hook or service that consumes the provider.

This example proves it by replacing HTTP with an in-memory command dispatch table - the same shape
a desktop shell would use for Tauri's `invoke`, an Electron bridge, or a Worker port.

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

Everything else. `getList`, `getOne`, `create`, `update`, `delete`, filter-to-query mapping, and
`value()` for pulling fields out of responses - all inherited unchanged. If your shell has no HTTP
concept whatsoever, you can override those methods too, following the same pattern: keep the
public shape, replace only what differs. This is the point of the base class existing as a
concrete default rather than an abstract contract - see [Design decisions](/overview/design-decisions.md).

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
of the container with `application.get()` and calls `send()` through the standard react-admin-style
API: a `products` list fetch, a single `products` fetch by id, and an `auth/login` POST. Each comes
back as ordinary ARDOR provider output - same shape as if it had gone over HTTP. A call to an
unknown command rejects with a 404-shaped error, exercising the same error path a bad HTTP response
would trigger.

## Takeaway

To add a new transport to ARDOR: subclass the default provider, override `send()` (and only the
other methods you actually need to differ), bind the subclass in `bindContext()`, and consume it
through the same `IDataProvider` interface everywhere else. See
[Adding a provider](/process/adding-a-provider.md) for the general checklist and
[Providers reference](/reference/providers.md) for what ships today.
