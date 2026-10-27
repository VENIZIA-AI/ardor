import { describe, expect, test } from 'bun:test';
import {
  FILTERS,
  formatDate,
  matchesFilter,
  parseEntry,
  sortEntries,
} from '../../../docs/wiki/site/.vitepress/theme/shared/changelog-entries.ts';
import { changelogFeed } from '../../../docs/wiki/site/.vitepress/theme/shared/changelog-feed.ts';

const entry = (opts: { slug: string; frontmatter?: Record<string, unknown>; src?: string }) =>
  parseEntry({
    url: `/changelogs/${opts.slug}`,
    frontmatter: {
      title: 'A title',
      description: 'A description.',
      packages: ['@x/core'],
      ...opts.frontmatter,
    },
    src: opts.src ?? '',
  });

describe('parseEntry', () => {
  test('reads the date from the file name, and the card text from the summary or the description', () => {
    const plain = entry({ slug: '2026-10-26-thing' });
    const summed = entry({ slug: '2026-10-26-thing', frontmatter: { summary: 'Better text.' } });

    expect(plain).toMatchObject({
      date: '2026-10-26',
      slug: '2026-10-26-thing',
      summary: 'A description.',
    });
    expect(summed?.summary).toBe('Better text.');
  });

  test('a file that is not a dated entry (index, template) is not an entry', () => {
    expect(entry({ slug: 'index' })).toBeNull();
    expect(entry({ slug: 'template' })).toBeNull();
  });

  test('the types come from the Badge line, ordered security first, with an author note dropped', () => {
    const parsed = entry({
      slug: '2026-10-26-x',
      src: '<Badge type="info" text="Bug Fix" /> <Badge type="danger" text="Security" /> <Badge type="tip" text="New Feature, not verified" />',
    });

    expect(parsed?.types.map((type) => type.label)).toEqual(['Security', 'Feature', 'Fix']);
  });

  test('explicit badges in the frontmatter win over the markup', () => {
    const parsed = entry({
      slug: '2026-10-26-x',
      frontmatter: { badges: ['Breaking Change'] },
      src: '<Badge text="Bug Fix" />',
    });

    expect(parsed?.types).toEqual([{ label: 'Breaking', group: 'breaking' }]);
  });

  test('a release overview is its own type, by frontmatter, file name or title', () => {
    for (const parsed of [
      entry({ slug: '2026-10-26-x', frontmatter: { type: 'release' } }),
      entry({ slug: '2026-10-25-vulcan-0-4-5-batch-overview' }),
      entry({ slug: '2026-10-25-y', frontmatter: { title: 'VULCAN 0.4.5: Things (Overview)' } }),
    ]) {
      expect(parsed?.isRelease).toBe(true);
      expect(parsed?.types).toEqual([{ label: 'Release', group: 'releases' }]);
    }
  });

  test('the version is the release override, else the first x.y.z of the title', () => {
    expect(
      entry({ slug: '2026-10-26-x', frontmatter: { release: '@x/core@1.2.3', title: 'v 9.9.9' } })
        ?.version,
    ).toBe('1.2.3');
    expect(
      entry({ slug: '2026-10-26-x', frontmatter: { title: 'VULCAN 0.4.5: A thing' } })?.version,
    ).toBe('0.4.5');
    expect(entry({ slug: '2026-10-26-x' })?.version).toBeNull();
  });

  test('packages are the frontmatter list, empty when there is none', () => {
    expect(entry({ slug: '2026-10-26-x' })?.packages).toEqual(['@x/core']);
    expect(entry({ slug: '2026-10-26-x', frontmatter: { packages: undefined } })?.packages).toEqual(
      [],
    );
  });
});

describe('sortEntries and the filters', () => {
  const list = [
    entry({ slug: '2026-10-25-a', src: '<Badge text="Bug Fix" />' }),
    entry({ slug: '2026-10-26-b', src: '<Badge text="Security" />' }),
    entry({ slug: '2026-10-26-vulcan-batch-overview' }),
    entry({ slug: '2026-10-26-a', src: '<Badge text="New Feature" />' }),
  ].filter((value) => value !== null);

  test('newest first; on one day an overview first, then the file name descending', () => {
    expect(sortEntries(list).map((value) => value.slug)).toEqual([
      '2026-10-26-vulcan-batch-overview',
      '2026-10-26-b',
      '2026-10-26-a',
      '2026-10-25-a',
    ]);
  });

  test('a tab shows the entries of its groups; All shows everything', () => {
    const shown = (id: string) =>
      list.filter((value) => matchesFilter(value, id)).map((value) => value.slug);

    expect(shown('all')).toHaveLength(4);
    expect(shown('security')).toEqual(['2026-10-26-b']);
    expect(shown('features')).toEqual(['2026-10-26-a']);
    expect(shown('fixes')).toEqual(['2026-10-25-a']);
    expect(shown('releases')).toEqual(['2026-10-26-vulcan-batch-overview']);
    expect(FILTERS.map((tab) => tab.id)).toEqual([
      'all',
      'releases',
      'features',
      'fixes',
      'security',
      'breaking',
    ]);
  });

  test('a date is written without the reader time zone', () => {
    expect(formatDate('2026-10-05')).toBe('October 5, 2026');
  });
});

describe('changelogFeed', () => {
  test('is RSS 2.0 with one item per entry, escaped, linked and dated', () => {
    const parsed = entry({
      slug: '2026-10-26-x',
      frontmatter: { title: 'A & B <c>' },
      src: '<Badge text="Security" />',
    });
    const xml = changelogFeed({
      site: { title: 'T', description: 'D', siteUrl: 'https://example.test/' },
      entries: parsed === null ? [] : [parsed],
    });

    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('<title>A &amp; B &lt;c&gt;</title>');
    expect(xml).toContain('<link>https://example.test/changelogs/2026-10-26-x</link>');
    expect(xml).toContain('<pubDate>Mon, 26 Oct 2026 12:00:00 GMT</pubDate>');
    expect(xml).toContain('<category>Security</category>');
  });
});
