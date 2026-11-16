import { useTranslate } from '@venizia/ardor';

export const CatalogSharePage = () => {
  const translate = useTranslate();

  return (
    <main>
      <h1>{translate('catalog.share.title')}</h1>
      <p>{translate('catalog.share.message')}</p>
    </main>
  );
};
