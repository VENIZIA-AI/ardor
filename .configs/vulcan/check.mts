import type { VulcanConfig } from '@venizia/vulcan';

export const check = {
  doctor: {
    privateValues: {
      acknowledged: [
        {
          path: 'docs/wiki/content/changelogs/2026-11-06-preset-hardening.md',
          types: ['url-credentials'],
          reason: 'The changelog describes the refused URL shape that carries a user and a password; no real credential.',
        },
        {
          path: 'presets/app/files/.configs/builders/Dockerfile',
          types: ['token'],
          reason: 'A comment showing the usage of the BuildKit secret flag of docker build; no real token.',
        },
        {
          path: 'scripts/preset/preset-smoke.ts',
          types: ['url-credentials'],
          reason: 'A fake database URL with a placeholder password, a fixture the smoke uses to prove config.js never carries it.',
        },
        {
          path: 'docs/wiki/content/changelogs/2026-10-25-preset-nginx.md',
          types: ['machine-path'],
          reason: 'Paths under the container user home in the image, not a developer machine.',
        },
      ],
    },
  },
} satisfies NonNullable<VulcanConfig.CheckType>;
