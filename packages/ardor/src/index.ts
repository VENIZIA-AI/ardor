// ARDOR - one entry point over the framework packages.
// An application imports from `@venizia/ardor`; a consumer that needs only one layer installs that
// package directly.

/**
 * Every ARDOR hook under one name: `Ardor.useRepository(...)` is the same function as
 * `useRepository`. Call a member by its name; do not index with a computed key (`Ardor[name]`), which
 * keeps every hook in a bundle.
 */
export * as Ardor from './ardor';
export * from '@venizia/ardor-kernel';
export * from '@venizia/ardor-react';
export * from '@venizia/ardor-admin';
