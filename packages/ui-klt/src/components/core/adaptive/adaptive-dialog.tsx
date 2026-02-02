import * as React from 'react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/shadcn/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/shadcn/drawer';
import { useIsMobile } from '@/hooks/use-mobile';

type AdaptiveDialogContextProps = {
  isMobile: boolean;
};

const AdaptiveDialogContext = React.createContext<AdaptiveDialogContextProps | null>(null);

const useAdaptiveDialog = () => {
  const context = React.useContext(AdaptiveDialogContext);
  if (!context) {
    throw new Error('useAdaptiveDialog must be used within a AdaptiveDialogProvider.');
  }

  return context;
};

const AdaptiveDialog = ({
  defaultOpen = false,
  children,
  open: openProp,
  onOpenChange: setOpenProp,
  ...props
}: React.ComponentProps<typeof Dialog>) => {
  // --------------------------------------------------
  const isMobile = useIsMobile();

  // --------------------------------------------------
  const [isMounted, setIsMounted] = React.useState(false);
  const [isOpenState, setIsOpenState] = React.useState(defaultOpen);

  // --------------------------------------------------
  const isOpen = openProp !== undefined ? openProp : isOpenState;
  const setIsOpen = setOpenProp !== undefined ? setOpenProp : setIsOpenState;

  // --------------------------------------------------
  const contextValue = React.useMemo<AdaptiveDialogContextProps>(
    () => ({
      isMobile,
    }),
    [isMobile],
  );

  // --------------------------------------------------
  React.useEffect(() => {
    setIsMounted(true);

    return () => {};
  }, []);

  // --------------------------------------------------
  if (!isMounted) {
    return null;
  }

  // --------------------------------------------------
  const Component = isMobile ? Drawer : Dialog;

  return (
    <AdaptiveDialogContext.Provider value={contextValue}>
      <Component {...props} open={isOpen} onOpenChange={setIsOpen}>
        {children}
      </Component>
    </AdaptiveDialogContext.Provider>
  );
};

const AdaptiveDialogTrigger = (props: React.ComponentProps<typeof DialogTrigger>) => {
  const { isMobile } = useAdaptiveDialog();
  return isMobile ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
};

const AdaptiveDialogContent = (props: React.ComponentProps<typeof DialogContent>) => {
  const { children, ...rest } = props;

  // --------------------------------------------------
  const { isMobile } = useAdaptiveDialog();

  // --------------------------------------------------
  if (isMobile) {
    return <DrawerContent {...rest}>{children}</DrawerContent>;
  }

  // --------------------------------------------------
  return <DialogContent {...props} />;
};

const AdaptiveDialogHeader = (props: React.ComponentProps<typeof DialogHeader>) => {
  const { isMobile } = useAdaptiveDialog();
  return isMobile ? <DrawerHeader {...props} /> : <DialogHeader {...props} />;
};

const AdaptiveDialogTitle = (props: React.ComponentProps<typeof DialogTitle>) => {
  const { isMobile } = useAdaptiveDialog();

  return isMobile ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
};

const AdaptiveDialogDescription = (props: React.ComponentProps<typeof DialogDescription>) => {
  const { isMobile } = useAdaptiveDialog();
  return isMobile ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
};

const AdaptiveDialogClose = (props: React.ComponentProps<typeof DialogClose>) => {
  const { isMobile } = useAdaptiveDialog();
  return isMobile ? <DrawerClose {...props} /> : <DialogClose {...props} />;
};

export {
  AdaptiveDialog,
  AdaptiveDialogClose,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
  AdaptiveDialogTrigger,
};
