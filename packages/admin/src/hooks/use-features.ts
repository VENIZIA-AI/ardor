import { useContext } from 'react';

import { useApplicationContainer } from '@venizia/ardor-react';

import { Features, MountedFeaturesContext, type TFeature } from '@/features/feature';

/**
 * The features the application mounts - for a menu, or a role editor listing their `permissions`:
 * the `features` prop of `ArdorApplication` when it passed one, else every bound feature.
 *
 * @useWhen a component needs the features the application mounts, for a menu or a role editor
 * @insteadOf a hand-kept list of features
 */
export const useFeatures = <TItem extends TFeature = TFeature>(): Array<TItem> => {
  const container = useApplicationContainer();
  const mounted = useContext(MountedFeaturesContext);

  return Features.read<TItem>({ container: mounted ?? container });
};
