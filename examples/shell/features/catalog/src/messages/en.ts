declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides {
    'catalog.list.title': unknown;
    'catalog.list.count': unknown;
    'catalog.share.title': unknown;
    'catalog.share.message': unknown;
  }
}

export const catalogEnglish = {
  catalog: {
    menu: { products: 'Products' },
    list: { title: 'Products', count: 'Products in the catalog' },
    share: {
      title: 'Our catalog',
      message: 'This page is public: it opens without signing in and outside the layout.',
    },
  },
};
