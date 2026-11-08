---
title: HttpRepository loses updateAll and deleteAll, use updateBy and deleteBy
description: The HTTP repository that ARDOR re-exports no longer has updateAll and deleteAll; updateBy and deleteBy take the same options and stay.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-11-08

## HttpRepository loses updateAll and deleteAll, use updateBy and deleteBy

<Badge type="warning" text="Breaking Change" />

**In one line.** ARDOR 0.4.8-9 peers on the IGNIS prerelease that removed `updateAll` and `deleteAll` from the HTTP repository that `@venizia/ardor/repository` re-exports. `updateBy` and `deleteBy` take the same options and stay.

## Breaking changes

**Who is affected.** Code that calls `repository.updateAll(...)` or `repository.deleteAll(...)`: it fails to compile and fails at run time. Everything else on the repository is unchanged.

```ts no-check
// Before
await repository.updateAll({ where, data });
await repository.deleteAll({ where });

// After
await repository.updateBy({ where, data });
await repository.deleteBy({ where });
// ... the same options as before, `options` included
```

`updateBy({ where, data, options? })` sends `PATCH` to the resource with `where` in the body, and `deleteBy({ where, options? })` sends `DELETE` with `where` in the body, as the two removed methods did.

Find the calls with `rg -n '\.(updateAll|deleteAll)\(' --glob '!node_modules'`.

## Who is affected

- **Code that calls `updateAll` or `deleteAll` on the HTTP repository.** Rename each call to `updateBy` or `deleteBy`.
- **Everything else.** No action needed.

See [Repository](../references/repository).
