import type { VulcanConfig } from '@venizia/vulcan';

export const common = {
  // The wiki palette is read from the manifest copy of this theme (docs/wiki/site/.vitepress/config.mts).
  theme: {
    accent: '#0277bd',
    accentDark: '#38bdf8',
    accentText: '#01579b',
    tokens: { 'accent-ink': { dark: '#03121c' } },
  },

  remove: { 'knowledge.atlas.sources': ['ardor'] },
} satisfies VulcanConfig.Common;
