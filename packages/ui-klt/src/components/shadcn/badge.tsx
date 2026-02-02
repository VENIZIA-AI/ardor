import * as React from 'react';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utilities/tw.utility';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-1.5 py-px text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary: 'border-none bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        destructive:
          'border-none bg-destructive/10 text-destructive focus-visible:ring-destructive/20 focus-visible:outline-none dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/5',
        red: 'border-none bg-red-600/10 text-red-600 focus-visible:ring-red-600/20 focus-visible:outline-none dark:bg-red-400/10 dark:text-red-400 dark:focus-visible:ring-red-400/40 [a&]:hover:bg-red-600/5 dark:[a&]:hover:bg-red-400/5',
        orange:
          'border-none bg-orange-600/10 text-orange-600 focus-visible:ring-orange-600/20 focus-visible:outline-none dark:bg-orange-400/10 dark:text-orange-400 dark:focus-visible:ring-orange-400/40 [a&]:hover:bg-orange-600/5 dark:[a&]:hover:bg-orange-400/5',
        amber:
          'border-none bg-amber-600/10 text-amber-600 focus-visible:ring-amber-600/20 focus-visible:outline-none dark:bg-amber-400/10 dark:text-amber-400 dark:focus-visible:ring-amber-400/40 [a&]:hover:bg-amber-600/5 dark:[a&]:hover:bg-amber-400/5',
        yellow:
          'border-none bg-yellow-600/10 text-yellow-600 focus-visible:ring-yellow-600/20 focus-visible:outline-none dark:bg-yellow-400/10 dark:text-yellow-400 dark:focus-visible:ring-yellow-400/40 [a&]:hover:bg-yellow-600/5 dark:[a&]:hover:bg-yellow-400/5',
        lime: 'border-none bg-lime-600/10 text-lime-600 focus-visible:ring-lime-600/20 focus-visible:outline-none dark:bg-lime-400/10 dark:text-lime-400 dark:focus-visible:ring-lime-400/40 [a&]:hover:bg-lime-600/5 dark:[a&]:hover:bg-lime-400/5',
        green:
          'border-none bg-green-600/10 text-green-600 focus-visible:ring-green-600/20 focus-visible:outline-none dark:bg-green-400/10 dark:text-green-400 dark:focus-visible:ring-green-400/40 [a&]:hover:bg-green-600/5 dark:[a&]:hover:bg-green-400/5',
        emerald:
          'border-none bg-emerald-600/10 text-emerald-600 focus-visible:ring-emerald-600/20 focus-visible:outline-none dark:bg-emerald-400/10 dark:text-emerald-400 dark:focus-visible:ring-emerald-400/40 [a&]:hover:bg-emerald-600/5 dark:[a&]:hover:bg-emerald-400/5',
        teal: 'border-none bg-teal-600/10 text-teal-600 focus-visible:ring-teal-600/20 focus-visible:outline-none dark:bg-teal-400/10 dark:text-teal-400 dark:focus-visible:ring-teal-400/40 [a&]:hover:bg-teal-600/5 dark:[a&]:hover:bg-teal-400/5',
        cyan: 'border-none bg-cyan-600/10 text-cyan-600 focus-visible:ring-cyan-600/20 focus-visible:outline-none dark:bg-cyan-400/10 dark:text-cyan-400 dark:focus-visible:ring-cyan-400/40 [a&]:hover:bg-cyan-600/5 dark:[a&]:hover:bg-cyan-400/5',
        sky: 'border-none bg-sky-600/10 text-sky-600 focus-visible:ring-sky-600/20 focus-visible:outline-none dark:bg-sky-400/10 dark:text-sky-400 dark:focus-visible:ring-sky-400/40 [a&]:hover:bg-sky-600/5 dark:[a&]:hover:bg-sky-400/5',
        blue: 'border-none bg-blue-600/10 text-blue-600 focus-visible:ring-blue-600/20 focus-visible:outline-none dark:bg-blue-400/10 dark:text-blue-400 dark:focus-visible:ring-blue-400/40 [a&]:hover:bg-blue-600/5 dark:[a&]:hover:bg-blue-400/5',
        indigo:
          'border-none bg-indigo-600/10 text-indigo-600 focus-visible:ring-indigo-600/20 focus-visible:outline-none dark:bg-indigo-400/10 dark:text-indigo-400 dark:focus-visible:ring-indigo-400/40 [a&]:hover:bg-indigo-600/5 dark:[a&]:hover:bg-indigo-400/5',
        violet:
          'border-none bg-violet-600/10 text-violet-600 focus-visible:ring-violet-600/20 focus-visible:outline-none dark:bg-violet-400/10 dark:text-violet-400 dark:focus-visible:ring-violet-400/40 [a&]:hover:bg-violet-600/5 dark:[a&]:hover:bg-violet-400/5',
        purple:
          'border-none bg-purple-600/10 text-purple-600 focus-visible:ring-purple-600/20 focus-visible:outline-none dark:bg-purple-400/10 dark:text-purple-400 dark:focus-visible:ring-purple-400/40 [a&]:hover:bg-purple-600/5 dark:[a&]:hover:bg-purple-400/5',
        fuchsia:
          'border-none bg-fuchsia-600/10 text-fuchsia-600 focus-visible:ring-fuchsia-600/20 focus-visible:outline-none dark:bg-fuchsia-400/10 dark:text-fuchsia-400 dark:focus-visible:ring-fuchsia-400/40 [a&]:hover:bg-fuchsia-600/5 dark:[a&]:hover:bg-fuchsia-400/5',
        pink: 'border-none bg-pink-600/10 text-pink-600 focus-visible:ring-pink-600/20 focus-visible:outline-none dark:bg-pink-400/10 dark:text-pink-400 dark:focus-visible:ring-pink-400/40 [a&]:hover:bg-pink-600/5 dark:[a&]:hover:bg-pink-400/5',
        rose: 'border-none bg-rose-600/10 text-rose-600 focus-visible:ring-rose-600/20 focus-visible:outline-none dark:bg-rose-400/10 dark:text-rose-400 dark:focus-visible:ring-rose-400/40 [a&]:hover:bg-rose-600/5 dark:[a&]:hover:bg-rose-400/5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

export type BadgeCompVariantsType = Extract<VariantProps<typeof badgeVariants>['variant'], string>;
