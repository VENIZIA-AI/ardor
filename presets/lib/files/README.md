# {{package}}

An ARDOR feature of {{project}}: `src/feature.ts` defines it with `Features.define`, `src/index.ts` exports it, and an app mounts it by listing it in `features()`.

```ts
import { feature } from '{{package}}';
```

`bun run typecheck`, `bun run lint`, `bun run test` and `bun run clean` are the scripts. There is no bundler and no dev server: an app that imports this package compiles its source.
