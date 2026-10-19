// The HTTP repository lives in IGNIS, where a server calling another server needs the same thing.
// ARDOR re-exports it on a sub-path so the root stays inside its budget, and so an app that never
// reads through a repository never has to install `@venizia/ignis-connectors`, an optional peer.
export * from '@venizia/ignis-connectors/http';

// The list-extras request lives in the IGNIS kernel, next to the reader both clients share.
export { HttpExtraRequest } from '@venizia/ignis-kernel/repository';
export type { TExtraRequest, TExtraResult } from '@venizia/ignis-kernel/repository';
