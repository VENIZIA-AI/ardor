import { defineRenderer } from '@venizia/vulcan/okf';

const PROVIDER_DIRS = ['packages/admin/src/providers', 'packages/kernel/src/base/providers'];

/** Every provider class the framework ships, by package directory. */
export default defineRenderer({
  id: 'providers',
  collect: ({ context }) =>
    context.source.exportedClasses({ dirs: PROVIDER_DIRS, suffix: 'Provider' }),
  render: ({ context, facts }) => {
    const total = facts.reduce((sum, entry) => sum + entry.classes.length, 0);
    const rows = facts.map((entry) => {
      const classes = entry.classes.map((name) => `\`${name}\``).join(' · ') || '_(see source)_';
      return `| \`${entry.dir}/\` | ${classes} |`;
    });

    return {
      path: 'reference/providers.md',
      content:
        context.page.header({
          title: 'Providers catalog',
          description: 'Every provider class the framework ships, by package directory (generated).',
          resource: 'packages/admin/src/providers',
          tags: ['reference', 'providers', 'catalog'],
        }) +
        context.page.note({
          seeAlso: 'Model: [data provider pipeline](/architecture/data-provider-pipeline.md).',
        }) +
        `**${total} provider classes across ${facts.length} directories.**\n\n` +
        ['| Directory | Classes |', '|---|---|', ...rows].join('\n') +
        '\n',
    };
  },
  coverage: ({ facts }) => ({
    name: 'providers',
    count: facts.reduce((sum, entry) => sum + entry.classes.length, 0),
  }),
});
