/**
 * The changelog index table and the changelog sidebar are generated from the entries, so they cannot
 * drift: every `content/changelogs/YYYY-MM-DD-*.md` is one table row and one sidebar link. The shape is
 * IGNIS's: an "Overview" group (Introduction, Template) and a "History" group with one collapsible
 * group per date, newest first.
 *
 *   bun scripts/changelogs.mts           rewrites the table of index.md and `changelogsSidebar` of config.mts
 *   bun scripts/changelogs.mts --check   fails when either differs from what the entries say
 *
 * An entry's title is its frontmatter `title`; its type is the text of its first `<Badge>`. Entries of one
 * date are ordered by file name.
 */
import { Glob } from 'bun';

const WIKI = new URL('..', import.meta.url).pathname;
const CHANGELOGS = `${WIKI}content/changelogs`;
const INDEX = `${CHANGELOGS}/index.md`;
const CONFIG = `${WIKI}site/.vitepress/config.mts`;
const SIDEBAR_START = 'const changelogsSidebar: DefaultTheme.SidebarItem[] = [';
const TABLE_HEADER = '| Date | Title | Type |\n|------|-------|------|\n';

const fail = (opts: { message: string }): never => {
  console.error(opts.message);
  process.exit(1);
};

interface IEntry {
  slug: string;
  date: string;
  title: string;
  type: string;
}

const readEntries = async (): Promise<IEntry[]> => {
  const entries: IEntry[] = [];

  for await (const file of new Glob('*.md').scan(CHANGELOGS)) {
    const slug = file.replace(/\.md$/, '');
    const date = /^(\d{4}-\d{2}-\d{2})-/.exec(slug)?.[1];

    if (date === undefined) {
      continue;
    }

    const text = await Bun.file(`${CHANGELOGS}/${file}`).text();
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
    const title = /^title:\s*(.+)$/m
      .exec(frontmatter)?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, '');
    const type = /<Badge type="[a-z]+" text="([^"]+)"/.exec(text)?.[1];

    if (title === undefined || type === undefined) {
      return fail({ message: `[changelogs] ${file} needs a frontmatter title and a <Badge>` });
    }

    entries.push({ slug, date, title, type });
  }

  return entries.sort((a, b) =>
    a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date),
  );
};

const quote = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const renderTable = (opts: { entries: IEntry[] }): string =>
  opts.entries.map(e => `| ${e.date} | [${e.title}](./${e.slug}) | ${e.type} |`).join('\n');

const renderSidebar = (opts: { entries: IEntry[] }): string => {
  const dates = [...new Set(opts.entries.map(e => e.date))];
  const groups = dates.map(date => {
    const items = opts.entries
      .filter(e => e.date === date)
      .map(e => `          { text: ${quote(e.title)}, link: ${quote(`/changelogs/${e.slug}`)} },`)
      .join('\n');

    return `      {\n        text: '${date}',\n        collapsed: true,\n        items: [\n${items}\n        ],\n      },`;
  });

  return `${SIDEBAR_START}
  {
    text: 'Overview',
    items: [
      { text: 'Introduction', link: '/changelogs/' },
      { text: 'Template', link: '/changelogs/template' },
    ],
  },
  {
    text: 'History',
    collapsed: false,
    items: [
${groups.join('\n')}
    ],
  },
];`;
};

/** Formatting is oxfmt's business; compare what the entries say, not how it is laid out. */
const normalize = (text: string): string => text.replace(/[\s'",\\]/g, '');

const main = async () => {
  const entries = await readEntries();
  const indexText = await Bun.file(INDEX).text();
  const tableStart = indexText.indexOf(TABLE_HEADER);

  if (tableStart === -1) {
    return fail({
      message: `[changelogs] index.md has no table with the header ${JSON.stringify(TABLE_HEADER)}`,
    });
  }

  const nextIndex = `${indexText.slice(0, tableStart)}${TABLE_HEADER}${renderTable({ entries })}\n`;
  const configText = await Bun.file(CONFIG).text();
  const sidebarStart = configText.indexOf(SIDEBAR_START);
  const sidebarEnd = configText.indexOf('\n];\n', sidebarStart);

  if (sidebarStart === -1 || sidebarEnd === -1) {
    return fail({ message: '[changelogs] config.mts has no `changelogsSidebar` constant' });
  }

  const sidebar = renderSidebar({ entries });
  const nextConfig = `${configText.slice(0, sidebarStart)}${sidebar}${configText.slice(sidebarEnd + 3)}`;

  if (Bun.argv.includes('--check')) {
    const drift: string[] = [];

    if (normalize(indexText) !== normalize(nextIndex)) {
      drift.push('content/changelogs/index.md');
    }

    if (normalize(configText.slice(sidebarStart, sidebarEnd + 3)) !== normalize(sidebar)) {
      drift.push('site/.vitepress/config.mts (changelogsSidebar)');
    }

    if (drift.length > 0) {
      console.error(
        `[changelogs] out of step with the entries: ${drift.join(', ')} - run: bun scripts/changelogs.mts`,
      );
      process.exit(1);
    }

    console.log(`[changelogs] ${entries.length} entries, index and sidebar match`);
    return;
  }

  await Bun.write(INDEX, nextIndex);
  await Bun.write(CONFIG, nextConfig);
  console.log(`[changelogs] wrote ${entries.length} entries to index.md and config.mts`);
};

await main();
