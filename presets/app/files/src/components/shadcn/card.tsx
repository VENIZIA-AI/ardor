import type { ComponentProps } from 'react';

import { cn } from '#src/utilities/tw.utility';

export const Card = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
    {...props}
  />
);
