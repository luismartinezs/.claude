import type { Author, Category } from './content';

// -- Article Type --

export type ArticleData = {
  title: string;
  summary: string;
  publishedAt: Date;
  updatedAt?: Date;
  image: string;
  categories: string[];
  author: string;
  draft: boolean;
};

export type Article = {
  id: string;
  data: ArticleData;
};

// -- Filtering --

/** Excludes drafts and articles with publishedAt in the future. */
export function filterPublished<T extends Article>(params: {
  articles: T[];
  now?: Date;
}): T[] {
  const now = params.now ?? new Date();
  return params.articles.filter(
    (a) => !a.data.draft && a.data.publishedAt <= now,
  );
}

// -- Sorting --

/** Sorts by publishedAt descending (newest first). */
export function sortByDate<T extends Article>(articles: T[]): T[] {
  return articles.toSorted(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}

// -- Related Articles --

/** Articles sharing ≥1 category with the current article, excluding itself. */
export function getRelatedArticles<T extends Article>(params: {
  currentId: string;
  categories: string[];
  allArticles: T[];
  limit?: number;
}): T[] {
  const { currentId, categories, allArticles, limit = 3 } = params;
  const categorySet = new Set(categories);
  return allArticles
    .filter(
      (a) =>
        a.id !== currentId &&
        a.data.categories.some((c) => categorySet.has(c)),
    )
    .slice(0, Math.max(0, limit));
}

// -- Category Filtering --

/** Articles that include the given category slug. */
export function getArticlesByCategory<T extends Article>(params: {
  categorySlug: string;
  articles: T[];
}): T[] {
  return params.articles.filter((a) =>
    a.data.categories.includes(params.categorySlug),
  );
}

// -- Resolution (throw on unknown — caught at build time) --

/** Looks up author by ID. Throws if not found. */
export function resolveAuthor(params: {
  authorId: string;
  authors: Record<string, Author>;
}): Author {
  const author = params.authors[params.authorId];
  if (!author) {
    throw new Error(
      `Unknown author "${params.authorId}". Valid authors: ${Object.keys(params.authors).join(', ')}`,
    );
  }
  return author;
}

/** Maps category slugs to Category objects. Throws on unknown slug. */
export function resolveCategories(params: {
  categorySlugs: string[];
  categories: Record<string, Category>;
}): Category[] {
  return params.categorySlugs.map((slug) => {
    const category = params.categories[slug];
    if (!category) {
      throw new Error(
        `Unknown category "${slug}". Valid categories: ${Object.keys(params.categories).join(', ')}`,
      );
    }
    return category;
  });
}
