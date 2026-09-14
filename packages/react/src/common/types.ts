import { type ReactNode } from 'react';

export interface SyncFC<P = {}> {
  (props: P): ReactNode;
}
