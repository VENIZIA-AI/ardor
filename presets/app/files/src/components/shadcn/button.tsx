import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '#src/utilities/tw.utility';

// Also applied to a router `Link`, so a link can look like a button.
export const buttonVariants = cva(
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border bg-card hover:bg-accent hover:text-accent-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export const Button = ({
  className,
  variant,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) => (
  <button className={cn(buttonVariants({ variant }), className)} {...props} />
);
