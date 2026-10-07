import { useInjectableContainer } from '@venizia/ardor-react';

import { type IFeature, readFeatures } from '@/features/feature';

/** The features the application mounts - for a menu, or a role editor listing their `permissions`. */
export const useFeatures = <TFeature extends IFeature = IFeature>(): Array<TFeature> => {
  const container = useInjectableContainer();
  return readFeatures<TFeature>({ container });
};
