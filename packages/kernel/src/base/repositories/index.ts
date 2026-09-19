// The HTTP repository lives in IGNIS, where a server calling another server needs the same thing.
// ARDOR re-exports it on a sub-path so the root stays inside its budget, and so an app that never
// reads through a repository never has to install `@venizia/ignis-connectors`, an optional peer.
export * from '@venizia/ignis-connectors/http';
