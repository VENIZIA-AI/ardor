export class OrdersAccess {
  static readonly RESOURCE = 'orders';
  static readonly LIST = 'list';
  static readonly SHOW = 'show';
  static readonly SUMMARY = 'summary';
}

export class OrdersPermissions {
  static readonly LIST = `${OrdersAccess.RESOURCE}.${OrdersAccess.LIST}`;
  static readonly SHOW = `${OrdersAccess.RESOURCE}.${OrdersAccess.SHOW}`;
  static readonly SUMMARY = `${OrdersAccess.RESOURCE}.${OrdersAccess.SUMMARY}`;
}

export class OrdersPaths {
  static readonly LIST = `/${OrdersAccess.RESOURCE}`;
  static readonly SUMMARY = `/${OrdersAccess.RESOURCE}/${OrdersAccess.SUMMARY}`;
}

export class OrderStatuses {
  static readonly OPEN = 'open';
  static readonly SHIPPED = 'shipped';
}

export type TOrderStatus = typeof OrderStatuses.OPEN | typeof OrderStatuses.SHIPPED;

export interface IOrder {
  id: number;
  reference: string;
  status: TOrderStatus;
  total: number;
}
