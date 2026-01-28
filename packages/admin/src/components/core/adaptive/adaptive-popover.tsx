import * as React from 'react';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/shadcn/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/popover';
import { useIsMobile } from '@/hooks/use-mobile';

type AdaptivePopoverContextProps = {
  isMobile: boolean;
};

const AdaptivePopoverContext = React.createContext<AdaptivePopoverContextProps | null>(null);

const useAdaptivePopover = () => {
  const context = React.useContext(AdaptivePopoverContext);
  if (!context) {
    throw new Error('useAdaptivePopover must be used within a AdaptivePopoverProvider.');
  }

  return context;
};

const AdaptivePopover = ({
  defaultOpen = false,
  children,
  open: openProp,
  onOpenChange: setOpenProp,
  ...props
}: React.ComponentProps<typeof Popover>) => {
  // --------------------------------------------------
  const isMobile = useIsMobile();

  // --------------------------------------------------
  const [isMounted, setIsMounted] = React.useState(false);
  const [isOpenState, setIsOpenState] = React.useState(defaultOpen);

  // --------------------------------------------------
  const isOpen = openProp !== undefined ? openProp : isOpenState;
  const setIsOpen = setOpenProp !== undefined ? setOpenProp : setIsOpenState;

  // --------------------------------------------------
  const contextValue = React.useMemo<AdaptivePopoverContextProps>(
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
  const Component = isMobile ? Drawer : Popover;

  return (
    <AdaptivePopoverContext.Provider value={contextValue}>
      <Component {...props} open={isOpen} onOpenChange={setIsOpen}>
        {children}
      </Component>
    </AdaptivePopoverContext.Provider>
  );
};

const AdaptivePopoverTrigger = (props: React.ComponentProps<typeof PopoverTrigger>) => {
  const { isMobile } = useAdaptivePopover();
  return isMobile ? <DrawerTrigger {...props} /> : <PopoverTrigger {...props} />;
};

const AdaptivePopoverContent = (props: React.ComponentProps<typeof PopoverContent>) => {
  const { children, ...rest } = props;

  // --------------------------------------------------
  const { isMobile } = useAdaptivePopover();

  // --------------------------------------------------
  if (isMobile) {
    return <DrawerContent {...rest}>{children}</DrawerContent>;
  }

  // --------------------------------------------------
  return <PopoverContent {...props} />;
};

const AdaptivePopoverHeader = (props: React.ComponentProps<typeof DrawerHeader>) => {
  const { isMobile } = useAdaptivePopover();
  return isMobile ? <DrawerHeader {...props} /> : null;
};

const AdaptivePopoverTitle = (props: React.ComponentProps<typeof DrawerTitle>) => {
  const { isMobile } = useAdaptivePopover();
  return isMobile ? <DrawerTitle {...props} /> : null;
};

const AdaptivePopoverDescription = (props: React.ComponentProps<typeof DrawerDescription>) => {
  const { isMobile } = useAdaptivePopover();
  return isMobile ? <DrawerDescription {...props} /> : null;
};

const AdaptivePopoverClose = (props: React.ComponentProps<typeof DrawerClose>) => {
  const { isMobile } = useAdaptivePopover();
  return isMobile ? <DrawerClose {...props} /> : null;
};

export {
  AdaptivePopover,
  AdaptivePopoverClose,
  AdaptivePopoverContent,
  AdaptivePopoverDescription,
  AdaptivePopoverHeader,
  AdaptivePopoverTitle,
  AdaptivePopoverTrigger,
};
