import type { VulcanConfig } from '@venizia/vulcan';

export const agent = {
  list: ['claude'],

  // The Venizia-stack rules: the app scripts, bun scripts, verb-first names, const classes and the awaited instance.
  packs: ['venizia'],

  // The base slot V-W-01: git writes happen only on the user's word (ARDOR's own W-01 agrees).
  rules: { 'V-W-01': 'on-user-word' },

  // Team-shared Claude settings that `vulcan sync` merges into `.claude/settings.json`. The two
  // plugins are off here by choice of the team, not a VULCAN default.
  claude: {
    settings: {
      enabledPlugins: {
        'figma@claude-plugins-official': false,
        'chrome-devtools-mcp@claude-plugins-official': false,
      },
    },
  },
} satisfies VulcanConfig.AgentType;
