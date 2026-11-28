import type { VulcanConfig } from '@venizia/vulcan';

export const project = {
  key: 'ARDOR',

  // In release order. `ui-kit` has no directory any more; retired, its tags and changelogs still resolve.
  packages: [
    { dir: 'kernel', name: '@venizia/ardor-kernel' },
    { dir: 'react', name: '@venizia/ardor-react' },
    { dir: 'admin', name: '@venizia/ardor-admin' },
    { dir: 'ardor', name: '@venizia/ardor' },
    { dir: 'ui-kit', name: '@venizia/ardor-ui-kit', retired: true },
  ],
} satisfies VulcanConfig.ProjectType;
