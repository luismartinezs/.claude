// Add to the target's src/content.config.ts (Astro 5 Content Layer API).
// Adjust `base` to wherever the target keeps its markdown articles.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/modules/blog/articles' }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1).max(160),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    image: z.string().min(1),
    categories: z.array(z.string()).min(1),
    author: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
