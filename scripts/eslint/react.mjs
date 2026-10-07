import { eslintConfigs, ReactEslintConfigs } from '@venizia/dev-configs';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Rules the IGNIS React preset relaxes for an application UI, where an event handler takes a promise
 * it never awaits. ARDOR is a framework: a dropped promise in a provider is a real bug, so each one
 * goes back to the base preset's own setting.
 */
const RELAXED_RULES = [
  '@typescript-eslint/no-floating-promises',
  'no-void',
  '@typescript-eslint/no-invalid-this',
  '@typescript-eslint/no-use-before-define',
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-shadow',
  '@typescript-eslint/no-unused-vars',
];

// The last config that sets a rule wins, as in ESLint itself.
const baseSetting = (rule) => {
  return [...eslintConfigs].reverse().find((config) => config.rules?.[rule])?.rules?.[rule];
};

const restoredRules = Object.fromEntries(
  RELAXED_RULES.flatMap((rule) => {
    const setting = baseSetting(rule);
    return setting === undefined ? [] : [[rule, setting]];
  }),
);

/** The base preset with the React, hooks and accessibility rules, and none of the base relaxed. */
export const reactConfigs = [
  ...ReactEslintConfigs.create({ plugins: { react, reactHooks, jsxA11y } }),
  {
    rules: {
      ...restoredRules,
      // The preset warns; ARDOR's lint fails only on an error, and allows no warning (B-02).
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
