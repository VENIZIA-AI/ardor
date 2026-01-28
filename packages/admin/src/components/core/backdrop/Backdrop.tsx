import { Spinner } from '@/components/shadcn/spinner';
import { cn } from '@/utilities/tw.utility';

export interface IBackdropProps extends React.ComponentProps<'div'> {
  open: boolean;
}

export const Backdrop = (props: IBackdropProps) => {
  const { className, open: isOpen, ...rest } = props;

  // --------------------------------------------------
  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-slot="backdrop"
      aria-hidden
      className={cn(
        'bg-background/50',
        'absolute inset-0 z-40',
        'flex items-center justify-center',
        className,
      )}
      {...rest}
    />
  );
};

const BackdropLoading: React.FC<React.ComponentProps<'svg'>> = (props) => {
  const { className, ...rest } = props;

  return (
    <Spinner {...rest} className={cn('absolute-center', 'text-primary', 'size-12', className)} />
  );
};

Backdrop.Loading = BackdropLoading;
