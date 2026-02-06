import { TelescopeIcon } from 'lucide-react';

import { cn } from '@/utilities/tw.utility';

export interface IComingSoonProps extends React.ComponentProps<'div'> {}

export const ComingSoon = (props: IComingSoonProps) => {
  const { className, children, ...rest } = props;

  return (
    <div className="size-full">
      <div
        className={cn(
          'm-auto',
          'size-full',
          'flex flex-col items-center justify-center gap-2',
          className,
        )}
        {...rest}>
        <TelescopeIcon size={72} />

        {children || (
          <>
            <ComingSoon.Title />
            <ComingSoon.Description />
          </>
        )}
      </div>
    </div>
  );
};

const ComingSoonTitle: React.FC<React.ComponentProps<'h1'>> = (props) => {
  const { className, children, ...rest } = props;

  return (
    <h1 {...rest} className={cn('text-4xl', 'leading-tight', 'font-bold', className)}>
      {children || <>Coming Soon!</>}
    </h1>
  );
};

const ComingSoonDescription: React.FC<React.ComponentProps<'p'>> = (props) => {
  const { className, children, ...rest } = props;

  return (
    <p {...rest} className={cn('text-muted-foreground', 'text-center', 'max-w-md', className)}>
      {children || (
        <>
          This page has not been created yet. <br />
          Stay tuned though!
        </>
      )}
    </p>
  );
};

ComingSoon.Title = ComingSoonTitle;
ComingSoon.Description = ComingSoonDescription;
