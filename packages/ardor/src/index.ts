// ARDOR - one entry point over the framework packages.
// An application imports from `@venizia/ardor`; a consumer that needs only one layer installs that
// package directly.

/**
 * Every ARDOR hook under one name: `Ardor.useRepository(...)` is the same function as
 * `useRepository`. Call a member by its name; do not index with a computed key (`Ardor[name]`), which
 * keeps every hook in a bundle.
 *
 * @example
 * ```tsx
 * import { Ardor, repository } from '@venizia/ardor';
 *
 * @repository()
 * class OrdersRepository {
 *   count() { return 3; }
 * }
 *
 * export const Orders = () => {
 *   const orders = Ardor.useRepository({ target: OrdersRepository });
 *   const container = Ardor.useApplicationContainer();
 *   return <span>{orders.count()} {container.isBound({ key: 'services.Orders' }) ? 'bound' : 'missing'}</span>;
 * };
 * ```
 */
export * as Ardor from './ardor';
export * from '@venizia/ardor-kernel';
export * from '@venizia/ardor-react';
export * from '@venizia/ardor-admin';
