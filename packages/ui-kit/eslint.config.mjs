import { eslintConfigs } from '@venizia/dev-configs';

const config = [
  ...eslintConfigs,
  {
    // Not part of the tsconfig project: vendored shadcn output, the Figma plugin bundle and the
    // token/export build scripts. The typed parser cannot resolve them.
    ignores: ['src/components/shadcn/', 'figma-plugin/', 'scripts/'],
  },
  {
    // `children` is a ReactNode: `false`, `''` and `0` are real values a caller passes to render
    // nothing, and `children || fallback` is the React idiom for "render the fallback instead".
    // `??` would render them. The rule's own escape for primitive-bearing unions, scoped to
    // components only.
    files: ['src/components/**/*.tsx'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { boolean: true, string: true, number: true } },
      ],
    },
  },
];

export default config;
