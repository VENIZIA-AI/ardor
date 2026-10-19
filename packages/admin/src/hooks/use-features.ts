import { useInjectableContainer } from '@venizia/ardor-react';

import { Features, type TFeature } from '@/features/feature';

/** The features the application mounts - for a menu, or a role editor listing their `permissions`. */
export const useFeatures = <TItem extends TFeature = TFeature>(): Array<TItem> => {
  const container = useInjectableContainer();
  return Features.read<TItem>({ container });
};
