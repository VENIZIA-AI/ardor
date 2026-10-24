import { defineRenderer } from '@venizia/vulcan/okf';

const HOOK_DIRS = ['packages/react/src/hooks', 'packages/admin/src/hooks'];
const SERVICE_DIRS = ['packages/kernel/src/base/services', 'packages/admin/src/services'];

const toRow = (opts: { dir: string; names: string[] }): string => {
  const names = opts.names.map(name => `\`${name}\``).join(' · ') || '_(see source)_';
  return `| \`${opts.dir}/\` | ${names} |`;
};

/** Every exported React hook and every service class, by package directory. */
export default defineRenderer({
  id: 'hooks-and-services',
  collect: ({ context }) => ({
    hooks: context.source.exportedNames({
      dirs: HOOK_DIRS,
      pattern: /export\s+(?:const|function)\s+(use[A-Z]\w*)/,
    }),
    services: context.source.exportedClasses({ dirs: SERVICE_DIRS, suffix: 'Service' }),
  }),
  render: ({ context, facts }) => {
    const total = facts.hooks.reduce((sum, entry) => sum + entry.names.length, 0);
    const hookRows = facts.hooks.map(entry => toRow({ dir: entry.dir, names: entry.names }));
    const serviceRows = facts.services.map(entry =>
      toRow({ dir: entry.dir, names: entry.classes }),
    );

    return {
      path: 'reference/hooks-and-services.md',
      content:
        context.page.header({
          title: 'Hooks and services catalog',
          description:
            'Every exported React hook and every service class, by package directory (generated).',
          resource: 'packages/react/src/hooks',
          tags: ['reference', 'hooks', 'services', 'catalog'],
        }) +
        context.page.note({
          seeAlso: 'Model: [hooks and context](/architecture/hooks-and-context.md).',
        }) +
        `**${total} hooks across ${facts.hooks.length} directories.**\n\n` +
        ['| Directory | Hooks |', '|---|---|', ...hookRows].join('\n') +
        '\n\n## Services\n\n' +
        ['| Directory | Classes |', '|---|---|', ...serviceRows].join('\n') +
        '\n',
    };
  },
  coverage: ({ facts }) => ({
    name: 'hooks',
    count: facts.hooks.reduce((sum, entry) => sum + entry.names.length, 0),
  }),
});
