export class CatalogFeature {
  static readonly NAME = 'catalog';
  static readonly API_URL = '/api';
}

export class CatalogMenu {
  static readonly PRODUCTS = 'catalog.menu.products';
}

export class CatalogAccess {
  static readonly RESOURCE = 'products';
  static readonly LIST = 'list';
}

export class CatalogPermissions {
  static readonly LIST = `${CatalogAccess.RESOURCE}.${CatalogAccess.LIST}`;
}

export class CatalogPaths {
  static readonly LIST = `/${CatalogAccess.RESOURCE}`;
  static readonly SHARE = '/catalog/share';
}

export interface IProduct {
  id: number;
  name: string;
  price: number;
}
