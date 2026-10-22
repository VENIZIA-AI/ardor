import type { ReactNode } from 'react';

export interface ISyncFC<TProps = Record<string, unknown>> {
  (props: TProps): ReactNode;
}
