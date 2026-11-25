import type { VulcanConfig } from '@venizia/vulcan';

export const check = {
  doctor: {
    privateValues: {
      acknowledged: [
        {
          path: 'docs/wiki/content/changelogs/2026-11-06-preset-hardening.md',
          types: ['url-credentials'],
          reason: 'The changelog describes the refused `scheme://user:password@host` shape; no real credential.',
        },
        {
          path: 'presets/app/files/.configs/builders/Dockerfile',
          types: ['token'],
          reason: 'Comments about BuildKit secrets and digest pins (`--mount=type=secret,id=bunfig`, `image@sha256:...`); no real token.',
        },
        {
          path: 'scripts/preset/preset-smoke.ts',
          types: ['url-credentials'],
          reason: 'Test fixture `postgres://user:do-not-publish@db/app` that the smoke proves the preset refuses to publish.',
        },
        {
          path: 'docs/wiki/content/changelogs/2026-10-25-preset-nginx.md',
          types: ['machine-path'],
          reason: 'Paths inside the container image (`/home/bun/app/...`), not a developer machine.',
        },
      ],
    },
  },
} satisfies NonNullable<VulcanConfig.Check>;
