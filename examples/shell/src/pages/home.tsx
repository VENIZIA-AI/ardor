import { useTranslate } from '@venizia/ardor';

export const HomePage = () => {
  const translate = useTranslate();

  return <p>{translate('shell.home')}</p>;
};
