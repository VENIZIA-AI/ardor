import type { ReactNode } from 'react';

/** @deprecated Write `(props: TProps) => ReactNode`. Removed in 0.5. */
export interface ISyncFC<TProps = Record<string, unknown>> {
  (props: TProps): ReactNode;
}
