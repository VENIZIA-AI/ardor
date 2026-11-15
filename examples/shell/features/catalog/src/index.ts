import { Features } from '@venizia/ardor';

import {
  CatalogAccess,
  CatalogFeature,
  CatalogMenu,
  CatalogPaths,
  CatalogPermissions,
} from './constants';
import { CatalogDataSource } from './datasources/catalog.datasource';
import { catalogEnglish } from './messages/en';
import { catalogVietnamese } from './messages/vi';
import { CatalogSharePage } from './pages/share';
import { ProductListPage } from './pages/product-list';
import { ProductRepository } from './repositories/product.repository';

export { CatalogAccess, CatalogPaths, CatalogPermissions } from './constants';

export const catalogFeature = Features.define({
  name: CatalogFeature.NAME,
  resources: [{ name: CatalogAccess.RESOURCE, list: ProductListPage }],
  routes: [
    {
      path: CatalogPaths.SHARE,
      Component: CatalogSharePage,
      layout: { use: false },
      auth: { use: false },
    },
  ],
  menu: [
    {
      label: CatalogMenu.PRODUCTS,
      to: CatalogPaths.LIST,
      access: { resource: CatalogAccess.RESOURCE, action: CatalogAccess.LIST },
    },
  ],
  messages: { en: catalogEnglish, vi: catalogVietnamese },
  artifacts: { dataSources: [CatalogDataSource], repositories: [ProductRepository] },
  permissions: [CatalogPermissions.LIST],
});
