---
title: The generated app sends a report-only CSP and checks its container input
description: The app preset sends Content-Security-Policy-Report-Only, hides the nginx version, refuses more secret-looking VITE_ values and checks NGINX_LOCAL_RESOLVERS.
packages: ['@venizia/ardor']
---

# Changelog - 2026-11-06

## The generated app sends a report-only CSP and checks its container input

<Badge type="warning" text="Behavior Change" />

**In one line.** An app created from the preset now sends a `Content-Security-Policy-Report-Only` header, no longer names its nginx version, stops on more secret-looking `VITE_` variables, and checks `NGINX_LOCAL_RESOLVERS` the way it checks `API_UPSTREAM`.

## What changed

- **A report-only CSP.** `nginx-snippets/security-headers.conf` sends a policy that fits the generated app (`default-src 'self'`, no objects, `frame-ancestors 'self'`). It blocks nothing: the browser console lists what it would block. An app that loads from another origin adds it to the policy; rename the header to `Content-Security-Policy` to enforce.
- **No nginx version.** `server_tokens off` removes it from the `Server` header and error pages.
- **More secrets refused.** A `VITE_` name with `PASSWD`, `PASSPHRASE`, `PASSCODE`, `PASS` (as a word), `PRIVATE` or `CREDENTIAL` in it, or a value that is a URL carrying a user and a password (`scheme://user:password@host`, also with an empty user or no scheme), stops the container with the variable named and its value never printed. It is a best-effort tripwire, not a secret scanner: a token in a query string, or a name it does not know, is still published. A public `DSN` or `KEY` is still published, and so is a value that only has an `@` in it.
- **The resolvers are checked.** `NGINX_LOCAL_RESOLVERS` may hold only IPv4 or bracketed IPv6 addresses (an optional `:port`) and spaces, and with `API_UPSTREAM` set it must not be blank; anything else stops the container. A host name is refused on purpose: nginx would resolve it with the resolver it is configuring.
- **Notes in the files.** The proxy snippet says that `X-Forwarded-For` keeps what a trusted front proxy sends and that `$scheme` is `http` behind it; the Dockerfile says not to put credentials in the registry URL and how to mount a `bunfig.toml` as a build secret.

A name that is plain configuration but contains one of those words (`VITE_PRIVATE_MODE`, `VITE_CREDENTIALS_MODE`) is refused too: rename it.

## Who is affected

- **An app that is already generated.** The files are yours; copy the changes you want.
- **A new app.** It reports CSP violations in the browser console until you adapt or accept the policy.
