import type { IDataProvider } from '@/common';
import type { DefaultRestDataProvider } from '@/providers/rest-data';

export class ReactAdminDataFactory {
  /**
   * The object react-admin holds. react-admin passes positional arguments, `(resource, params)`: each
   * method hands them to the `opts` method of the provider, so a subclass override is reached.
   */
  static build<TResource extends string>(opts: {
    provider: Pick<
      DefaultRestDataProvider<TResource>,
      | 'getList'
      | 'getOne'
      | 'getMany'
      | 'getManyReference'
      | 'create'
      | 'update'
      | 'updateMany'
      | 'delete'
      | 'deleteMany'
      | 'send'
      | 'getNetworkService'
      | 'getDataSourceAuth'
    >;
  }): IDataProvider<TResource> {
    const { provider } = opts;

    return {
      supportAbortSignal: true,
      getList: (resource, params) => {
        return provider.getList({ resource, params: { ...params } });
      },
      getOne: (resource, params) => {
        return provider.getOne({ resource, params });
      },
      getMany: (resource, params) => {
        return provider.getMany({ resource, params });
      },
      getManyReference: (resource, params) => {
        return provider.getManyReference({ resource, params: { ...params } });
      },
      create: (resource, params) => {
        return provider.create({ resource, params });
      },
      update: (resource, params) => {
        return provider.update({ resource, params });
      },
      updateMany: (resource, params) => {
        return provider.updateMany({ resource, params });
      },
      delete: (resource, params) => {
        return provider.delete({ resource, params });
      },
      deleteMany: (resource, params) => {
        return provider.deleteMany({ resource, params });
      },
      // Bound, so both shapes of `send` stay on the provider react-admin and the app see.
      send: provider.send.bind(provider),
      getNetworkService: () => {
        return provider.getNetworkService();
      },
      getDataSourceAuth: () => {
        return provider.getDataSourceAuth();
      },
    };
  }
}
