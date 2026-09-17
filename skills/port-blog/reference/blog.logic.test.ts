import { describe, it, expect } from 'bun:test';
import {
  filterPublished,
  sortByDate,
  getRelatedArticles,
  getArticlesByCategory,
  resolveAuthor,
  resolveCategories,
  type Article,
} from './blog.logic';
import type { Author, Category } from './content';

// -- Helpers --

import type { ArticleData } from './blog.logic';

const makeArticle = (overrides: { id?: string; data?: Partial<ArticleData> } = {}): Article => ({
  id: overrides.id ?? 'test-article',
  data: {
    title: 'Test Article',
    summary: 'A test summary.',
    publishedAt: new Date('2026-02-10'),
    image: 'https://example.com/image.jpg',
    categories: ['travel-tips'],
    author: 'luis',
    draft: false,
    ...overrides.data,
  },
});

const TEST_AUTHORS: Record<string, Author> = {
  luis: {
    id: 'luis',
    name: 'Luis Martinez',
    role: 'Founder',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Building HelloSafelyFed.',
  },
};

const TEST_CATEGORIES: Record<string, Category> = {
  'travel-tips': {
    slug: 'travel-tips',
    label: 'Travel Tips',
    description: 'Practical advice for navigating food abroad.',
  },
  'dietary-guides': {
    slug: 'dietary-guides',
    label: 'Dietary Guides',
    description: 'Deep dives into managing dietary restrictions.',
  },
};

// ────────────────────────────────────────────────
// 1. filterPublished
// ────────────────────────────────────────────────

describe('filterPublished', () => {
  const now = new Date('2026-02-15');

  // -- Happy path --

  it('returns published articles with past dates', () => {
    const articles = [makeArticle({ data: { publishedAt: new Date('2026-02-10') } })];
    expect(filterPublished({ articles, now })).toHaveLength(1);
  });

  it('excludes drafts', () => {
    const articles = [makeArticle({ data: { draft: true } })];
    expect(filterPublished({ articles, now })).toEqual([]);
  });

  it('excludes articles with future publishedAt', () => {
    const articles = [makeArticle({ data: { publishedAt: new Date('2026-02-20') } })];
    expect(filterPublished({ articles, now })).toEqual([]);
  });

  it('excludes drafts even with past publishedAt', () => {
    const articles = [
      makeArticle({ data: { draft: true, publishedAt: new Date('2026-02-01') } }),
    ];
    expect(filterPublished({ articles, now })).toEqual([]);
  });

  // -- Edge cases --

  it('returns empty array for empty input', () => {
    expect(filterPublished({ articles: [], now })).toEqual([]);
  });

  it('includes articles published exactly at now', () => {
    const articles = [makeArticle({ data: { publishedAt: new Date('2026-02-15') } })];
    expect(filterPublished({ articles, now })).toHaveLength(1);
  });

  it('defaults now to current time when not provided', () => {
    const articles = [makeArticle({ data: { publishedAt: new Date('2020-01-01') } })];
    expect(filterPublished({ articles })).toHaveLength(1);
  });

  it('filters mixed array correctly', () => {
    const articles = [
      makeArticle({ id: 'published', data: { publishedAt: new Date('2026-02-01') } }),
      makeArticle({ id: 'draft', data: { draft: true } }),
      makeArticle({ id: 'future', data: { publishedAt: new Date('2026-03-01') } }),
      makeArticle({ id: 'also-published', data: { publishedAt: new Date('2026-02-10') } }),
    ];
    const result = filterPublished({ articles, now });
    expect(result.map((a) => a.id)).toEqual(['published', 'also-published']);
  });
});

// ────────────────────────────────────────────────
// 2. sortByDate
// ────────────────────────────────────────────────

describe('sortByDate', () => {
  // -- Happy path --

  it('sorts newest first', () => {
    const articles = [
      makeArticle({ id: 'old', data: { publishedAt: new Date('2026-01-01') } }),
      makeArticle({ id: 'new', data: { publishedAt: new Date('2026-02-20') } }),
      makeArticle({ id: 'mid', data: { publishedAt: new Date('2026-02-10') } }),
    ];
    expect(sortByDate(articles).map((a) => a.id)).toEqual(['new', 'mid', 'old']);
  });

  // -- Edge cases --

  it('returns empty array for empty input', () => {
    expect(sortByDate([])).toEqual([]);
  });

  it('returns single article unchanged', () => {
    const articles = [makeArticle({ id: 'only' })];
    expect(sortByDate(articles).map((a) => a.id)).toEqual(['only']);
  });

  it('preserves order for articles with the same date', () => {
    const date = new Date('2026-02-10');
    const articles = [
      makeArticle({ id: 'first', data: { publishedAt: date } }),
      makeArticle({ id: 'second', data: { publishedAt: date } }),
    ];
    const result = sortByDate(articles);
    expect(result).toHaveLength(2);
  });

  it('does not mutate the original array', () => {
    const articles = [
      makeArticle({ id: 'b', data: { publishedAt: new Date('2026-01-01') } }),
      makeArticle({ id: 'a', data: { publishedAt: new Date('2026-02-01') } }),
    ];
    const sorted = sortByDate(articles);
    expect(articles[0]!.id).toBe('b');
    expect(sorted[0]!.id).toBe('a');
  });
});

// ────────────────────────────────────────────────
// 3. getRelatedArticles
// ────────────────────────────────────────────────

describe('getRelatedArticles', () => {
  const allArticles = [
    makeArticle({ id: 'current', data: { categories: ['travel-tips', 'dietary-guides'] } }),
    makeArticle({ id: 'related-1', data: { categories: ['travel-tips'] } }),
    makeArticle({ id: 'related-2', data: { categories: ['dietary-guides'] } }),
    makeArticle({ id: 'unrelated', data: { categories: ['product-updates'] } }),
  ];

  // -- Happy path --

  it('returns articles sharing at least one category', () => {
    const result = getRelatedArticles({
      currentId: 'current',
      categories: ['travel-tips', 'dietary-guides'],
      allArticles,
    });
    expect(result.map((a) => a.id)).toEqual(['related-1', 'related-2']);
  });

  it('excludes the current article', () => {
    const result = getRelatedArticles({
      currentId: 'current',
      categories: ['travel-tips'],
      allArticles,
    });
    expect(result.find((a) => a.id === 'current')).toBeUndefined();
  });

  it('respects default limit of 3', () => {
    const manyArticles = [
      makeArticle({ id: 'current', data: { categories: ['travel-tips'] } }),
      ...Array.from({ length: 5 }, (_, i) =>
        makeArticle({ id: `related-${i}`, data: { categories: ['travel-tips'] } }),
      ),
    ];
    const result = getRelatedArticles({
      currentId: 'current',
      categories: ['travel-tips'],
      allArticles: manyArticles,
    });
    expect(result).toHaveLength(3);
  });

  it('respects custom limit', () => {
    const result = getRelatedArticles({
      currentId: 'current',
      categories: ['travel-tips', 'dietary-guides'],
      allArticles,
      limit: 1,
    });
    expect(result).toHaveLength(1);
  });

  // -- Edge cases --

  it('returns empty array when no articles share categories', () => {
    const result = getRelatedArticles({
      currentId: 'current',
      categories: ['product-updates'],
      allArticles: [
        makeArticle({ id: 'current', data: { categories: ['product-updates'] } }),
        makeArticle({ id: 'other', data: { categories: ['travel-tips'] } }),
      ],
    });
    expect(result).toEqual([]);
  });

  it('returns empty array for empty allArticles', () => {
    const result = getRelatedArticles({
      currentId: 'current',
      categories: ['travel-tips'],
      allArticles: [],
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when categories list is empty', () => {
    const result = getRelatedArticles({
      currentId: 'current',
      categories: [],
      allArticles,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when limit is 0', () => {
    const result = getRelatedArticles({
      currentId: 'current',
      categories: ['travel-tips'],
      allArticles,
      limit: 0,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when limit is negative', () => {
    const manyArticles = [
      makeArticle({ id: 'current', data: { categories: ['travel-tips'] } }),
      makeArticle({ id: 'r1', data: { categories: ['travel-tips'] } }),
      makeArticle({ id: 'r2', data: { categories: ['travel-tips'] } }),
      makeArticle({ id: 'r3', data: { categories: ['travel-tips'] } }),
    ];
    const result = getRelatedArticles({
      currentId: 'current',
      categories: ['travel-tips'],
      allArticles: manyArticles,
      limit: -1,
    });
    expect(result).toEqual([]);
  });

  it('works when currentId is not in allArticles', () => {
    const result = getRelatedArticles({
      currentId: 'nonexistent',
      categories: ['travel-tips'],
      allArticles,
    });
    expect(result.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────
// 4. getArticlesByCategory
// ────────────────────────────────────────────────

describe('getArticlesByCategory', () => {
  const articles = [
    makeArticle({ id: 'tips-1', data: { categories: ['travel-tips'] } }),
    makeArticle({ id: 'guides-1', data: { categories: ['dietary-guides'] } }),
    makeArticle({ id: 'both', data: { categories: ['travel-tips', 'dietary-guides'] } }),
  ];

  // -- Happy path --

  it('returns articles containing the category', () => {
    const result = getArticlesByCategory({ categorySlug: 'travel-tips', articles });
    expect(result.map((a) => a.id)).toEqual(['tips-1', 'both']);
  });

  it('includes articles with multiple categories', () => {
    const result = getArticlesByCategory({ categorySlug: 'dietary-guides', articles });
    expect(result.map((a) => a.id)).toEqual(['guides-1', 'both']);
  });

  // -- Edge cases --

  it('returns empty array for empty input', () => {
    expect(getArticlesByCategory({ categorySlug: 'travel-tips', articles: [] })).toEqual([]);
  });

  it('returns empty array when no articles match', () => {
    expect(getArticlesByCategory({ categorySlug: 'product-updates', articles })).toEqual([]);
  });

  it('is case-sensitive (does not match different casing)', () => {
    expect(getArticlesByCategory({ categorySlug: 'Travel-Tips', articles })).toEqual([]);
  });
});

// ────────────────────────────────────────────────
// 5. resolveAuthor
// ────────────────────────────────────────────────

describe('resolveAuthor', () => {
  // -- Happy path --

  it('returns the matching author', () => {
    const result = resolveAuthor({ authorId: 'luis', authors: TEST_AUTHORS });
    expect(result.name).toBe('Luis Martinez');
    expect(result.id).toBe('luis');
  });

  // -- Edge cases --

  it('throws on unknown author ID', () => {
    expect(() =>
      resolveAuthor({ authorId: 'unknown', authors: TEST_AUTHORS }),
    ).toThrow('Unknown author "unknown"');
  });

  it('includes valid author IDs in error message', () => {
    expect(() =>
      resolveAuthor({ authorId: 'nobody', authors: TEST_AUTHORS }),
    ).toThrow('luis');
  });

  it('throws on empty authors dictionary', () => {
    expect(() => resolveAuthor({ authorId: 'luis', authors: {} })).toThrow(
      'Unknown author "luis"',
    );
  });
});

// ────────────────────────────────────────────────
// 6. resolveCategories
// ────────────────────────────────────────────────

describe('resolveCategories', () => {
  // -- Happy path --

  it('maps slugs to category objects', () => {
    const result = resolveCategories({
      categorySlugs: ['travel-tips', 'dietary-guides'],
      categories: TEST_CATEGORIES,
    });
    expect(result).toHaveLength(2);
    expect(result[0]!.label).toBe('Travel Tips');
    expect(result[1]!.label).toBe('Dietary Guides');
  });

  it('returns single category for single slug', () => {
    const result = resolveCategories({
      categorySlugs: ['travel-tips'],
      categories: TEST_CATEGORIES,
    });
    expect(result).toEqual([TEST_CATEGORIES['travel-tips']!]);
  });

  // -- Edge cases --

  it('returns empty array for empty slugs', () => {
    expect(
      resolveCategories({ categorySlugs: [], categories: TEST_CATEGORIES }),
    ).toEqual([]);
  });

  it('throws on unknown category slug', () => {
    expect(() =>
      resolveCategories({
        categorySlugs: ['nonexistent'],
        categories: TEST_CATEGORIES,
      }),
    ).toThrow('Unknown category "nonexistent"');
  });

  it('includes valid category slugs in error message', () => {
    expect(() =>
      resolveCategories({
        categorySlugs: ['bad-slug'],
        categories: TEST_CATEGORIES,
      }),
    ).toThrow('travel-tips');
  });

  it('throws on first unknown slug in mixed array', () => {
    expect(() =>
      resolveCategories({
        categorySlugs: ['travel-tips', 'bad-slug'],
        categories: TEST_CATEGORIES,
      }),
    ).toThrow('Unknown category "bad-slug"');
  });

  it('returns duplicate entries for duplicate slugs', () => {
    const result = resolveCategories({
      categorySlugs: ['travel-tips', 'travel-tips'],
      categories: TEST_CATEGORIES,
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(result[1]);
  });
});
