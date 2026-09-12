import { type ReactNode } from 'react';

/**
 * @description A type for synchronous functional components that return React nodes (React 19+).
 */

export interface SyncFC<P = {}> {
  (props: P): ReactNode;
}
