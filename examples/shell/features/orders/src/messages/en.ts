declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides {
    'orders.list.title': unknown;
    'orders.summary.title': unknown;
    'orders.summary.open': unknown;
    'orders.summary.shipped': unknown;
  }
}

export const ordersEnglish = {
  orders: {
    menu: { list: 'Orders', summary: 'Order summary' },
    list: { title: 'Orders' },
    summary: { title: 'Order summary', open: 'Open', shipped: 'Shipped' },
  },
};
