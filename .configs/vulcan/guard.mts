import type { VulcanConfig } from '@venizia/vulcan';

export const guard = { runners: { allow: ['shadcn', 'vite'] } } satisfies NonNullable<VulcanConfig.GuardType>;
