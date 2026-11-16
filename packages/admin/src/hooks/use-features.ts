import { useContext } from 'react';

import { useApplicationContainer } from '@venizia/ardor-react';

import { Features, MountedFeaturesContext, type TFeature } from '@/features/feature';

/**
 * The features the application mounts - for a menu, or a role editor listing their `permissions`:
 * the `features` prop of `ArdorApplication` when it passed one, else every bound feature.
 */
export const useFeatures = <TItem extends TFeature = TFeature>(): Array<TItem> => {
  const container = useApplicationContainer();
  const mounted = useContext(MountedFeaturesContext);

  return Features.read<TItem>({ container: mounted ?? container });
};
