import { eslintConfigs } from '@venizia/dev-configs';

const config = [
  ...eslintConfigs,
  {
    ignores: ['src/components/shadcn/'],
  },
];

export default config;
