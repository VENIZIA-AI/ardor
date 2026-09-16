/**
 * The stereotypes an ARDOR application declares its classes with, re-exported from
 * `@venizia/ignis-kernel/metadata`.
 *
 * ARDOR does not define its own. A stereotype writes the binding key onto the class through
 * `reflect-metadata` and appends it to a discovery list that `AbstractArdorApplication.registerArtifacts`
 * reads - one mechanism for the whole VENIZIA family, so a class written for a worker and a class
 * written for a browser register the same way.
 *
 * Listed export by export rather than `export *`. What ARDOR publishes is a decision, not whatever
 * the upstream sub-path grows into: a name added there tomorrow must be added here on purpose, and a
 * name that would collide with ARDOR's own surface is caught at this line instead of in a consumer.
 *
 * `CoreBindings` is the collision that already happened. IGNIS's and ARDOR's are different
 * dictionaries that share the member `APPLICATION_INSTANCE` with different values - `'@app/instance'`
 * against `'@app/application/instance'`. Upstream dropped theirs from `./metadata` for that reason;
 * ARDOR's own stays the only one reachable from this package.
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
