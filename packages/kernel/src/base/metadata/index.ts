/**
 * The IGNIS stereotypes, re-exported name by name so ARDOR's surface changes only on purpose.
 * `CoreBindings` is deliberately absent: IGNIS's disagrees with ARDOR's on `APPLICATION_INSTANCE`.
 */
export {
  component,
  configuration,
  datasource,
  inject,
  injectable,
  model,
  provide,
  repository,
  service,
} from '@venizia/ignis-kernel/metadata';

export {
  ArtifactNamespaces,
  ArtifactTypes,
  BindingKeys,
  BindingNamespaces,
} from '@venizia/ignis-kernel/metadata';

export type {
  IArtifactMetadata,
  IArtifactRegistrationOptions,
  TBindingNamespace,
  TBindingScope,
} from '@venizia/ignis-kernel/metadata';
