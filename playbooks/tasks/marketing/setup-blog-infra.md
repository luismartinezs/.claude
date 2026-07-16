# TASK: Set Up Blog Infrastructure

## Objective
Stand up a static, build-validated blog in the project's Astro app, and emit `context/marketing/blog-infra.md`: the surface declaration that every downstream content task reads instead of hardcoding paths.

## Inputs
- Primary: The project (User Input: nothing, or specific requirements)
- Rules: `CLAUDE.md` (Required — the stack and its hard constraints)
- Architecture: `/home/luis/claymore/coding/vertical-slice-architecture.md` (Required — slice rules)
- Doctrine: `~/.claude/playbooks/tasks/marketing/_geo-rules.md` (Required — section 5, the technical surface)
- Context: `context/MEMORY.md` (Required)

## Role & Persona
You are a **Frontend Architect** building content infrastructure that a non-engineer will use every week.
You believe **the build is the QA**. A content error that reaches production is an infrastructure failure, not an author failure. Every constraint you can encode in a Zod schema is a class of bug that can never ship.
You are **allergic to hardcoded paths in prose**. Documentation that names a path is documentation that rots the moment someone moves a folder. You emit one declaration and make everything read it.

## Integration Strategy
- Rules: `CLAUDE.md` defines the stack. Read it before choosing anything. Do not introduce a framework, CMS, or dependency it does not already sanction.
- Architecture: the blog is static content. Read the doctrine's rules on rendering-mode splits and slice boundaries, and place files accordingly.
- Precedent: if the project already has any content collection, match its conventions exactly. Do not invent a second pattern.
- GEO rules section 5: the required schema types (BlogPosting, FAQPage, HowTo) and crawler surface. Build for them now; `setup-distribution-surface` wires the rest.

## Workflow Steps

### 1. Survey

> **PROTOCOL: Precedent Before Construction**
> 1. Read `CLAUDE.md` for the stack, the static-build constraint, and the styling rules.
> 2. Determine the real paths in THIS project: where pages live, where components live, where content collections live or would live, where public assets live. Do not assume a layout from another project.
> 3. Check whether a blog already exists. If it does, this task documents and upgrades it rather than rebuilding it.
> 4. Report what you found before writing code.

### 2. Define the Content Schema

The Zod schema is the contract. Every field you make required is a field an author cannot forget.

Required at minimum:
- `title` — the question-format headline
- `summary` — meta description, `.max()` constrained to the meta limit (~160 chars). Enforce it in the schema; a comment is not enforcement.
- `publishedAt` — date
- `author` — an enum or a reference to an authors registry, never a free string. Anonymous bylines are a GEO penalty, and a free string permits typos that silently break the byline.
- `categories` — array constrained to a category registry, never free strings.
- `draft` — boolean, defaults true. Nothing goes live by accident.

Optional:
- `updatedAt` — drives `dateModified` and sitemap `lastmod`. Freshness is a top-three ranking signal, so this field is load-bearing.
- `image` + `imageAlt`
- `faq` — structured question/answer pairs, if the project prefers generating FAQPage JSON-LD from data rather than parsing prose. Recommended: parsing headings for schema is brittle.
- `cta` — only if `geo-strategy.md` defines a multi-product CTA map. Omit entirely otherwise.

### 3. Build the Surface

Implement, following the project's existing conventions:
1. **Content collection** with the Zod schema, so bad frontmatter fails the build rather than shipping.
2. **Category and author registries** as typed constants, referenced by the schema.
3. **Index page** listing published (non-draft) posts.
4. **Article page** rendering a post, with the title as the page's single `h1`.
5. **JSON-LD**: BlogPosting on every article; FAQPage where FAQ data exists. Per GEO rules section 5, FAQ prose without FAQPage markup is invisible to AI retrieval, so this is not optional.
6. **Metadata**: OpenGraph article tags, `datePublished`, `dateModified`, canonical URL, breadcrumbs.
7. **Draft filtering**: drafts excluded from the index, the sitemap, and the build output.

### 4. Verify the Build Catches Errors

> **STEP: Adversarial Validation**
> A schema you did not try to break is a schema you do not know works.
> 1. Temporarily introduce each error class: missing required field, over-length summary,
>    invalid category slug, unknown author, malformed date.
> 2. Confirm the build **fails** on each.
> 3. Revert every deliberate error.
> 4. Run the project's typecheck and build. Both must pass clean.
> If any error class does not fail the build, the schema is too loose. Tighten it.

### 5. Emit the Surface Declaration

> **CRITICAL: This is the task's most durable output.**
> Downstream tasks (`draft-blog-post`, `publish-blog-post`, `setup-distribution-surface`)
> must never hardcode a path. They read `context/marketing/blog-infra.md`.
> That indirection is the entire reason this file exists: paths differ per project and
> change over time, while the tasks are global and shared across every project.
> Write the declaration from the code you actually built, by reading it back. Do not write
> it from memory or intent.

### 6. Record
Update `context/MEMORY.md` with the blog infrastructure decision and anything non-obvious a future reader would trip on.

## Constraints (Local Rules)
- **Static only.** Never add `output: 'server'`, an adapter, or `prerender = false`. This is a hard constraint from `CLAUDE.md` and it is not negotiable for a blog.
- **No new dependencies.** A markdown blog needs nothing the stack does not already have. Every `bun install` is a liability. If you believe one is required, stop and justify it to the user first.
- **No CMS.** Markdown files in the repo, versioned in git.
- **Registries, not free strings.** Categories and authors are typed and validated.
- **The build is the QA.** Any authoring error that can fail at build time must fail at build time.
- **Follow the project's architecture.** Read the doctrine. Do not invent a structure this project does not use.
- **Declaration written from the code**, verified by reading the code back, never from intent.

## Definition of Done

### Output Structure

**1.** A working blog in the project's frontend app: schema, registries, index page, article page, JSON-LD, draft filtering.

**2.** `context/marketing/blog-infra.md`:

```markdown
# Blog Infrastructure

**Emitted by:** `setup-blog-infra` on {YYYY-MM-DD}
**Purpose:** the single declaration of this project's content surface. Downstream tasks read
this file instead of hardcoding paths. If you move a folder, update this file in the same commit.

## Paths
| What | Where |
|---|---|
| Articles | `{real path}` |
| Content config / schema | `{real path}` |
| Category registry | `{real path}` |
| Author registry | `{real path}` |
| Article page template | `{real path}` |
| Public images | `{real path}` |
| Cover image script | `{real path, or "none"}` |

## Frontmatter Schema
| Field | Type | Required | Constraint |
|---|---|---|---|
| title | string | yes | |
| summary | string | yes | max {N} chars |
| publishedAt | date | yes | |
| author | enum | yes | see registry |
| categories | array | yes | see registry |
| draft | boolean | yes | defaults true |
| updatedAt | date | no | drives dateModified + sitemap lastmod |
| image | string | no | |
| imageAlt | string | no | |

**Template:**
```yaml
---
{the real, current frontmatter template}
---
```

## Valid Categories
| Slug | Label |
|---|---|

## Valid Authors
| ID | Name |
|---|---|

## URL Structure
| Page | Pattern |
|---|---|
| Index | `{pattern}` |
| Article | `{pattern}` |

Filename becomes the slug. Renaming a published file breaks its URL and forfeits its
accumulated authority. Treat published filenames as immutable.

## Build Validation
{What fails the build, verified adversarially in step 4.}

## Body Rules
- Body starts at `##`. The template renders the `h1` from frontmatter. A second `h1` in the body is a defect.
- {any other project-specific rule}

## JSON-LD
| Schema | Where | Source |
|---|---|---|
| BlogPosting | every article | frontmatter |
| FAQPage | articles with FAQ | {frontmatter `faq` field / parsed headings} |
```

### Quality Checklist
- [ ] `CLAUDE.md` and the architecture doctrine read before building
- [ ] Real project paths discovered, not assumed from another project
- [ ] Existing blog detected and upgraded rather than rebuilt, if present
- [ ] Static build preserved; no adapter, no `output: 'server'`, no `prerender = false`
- [ ] Zero new dependencies (or explicitly justified and approved)
- [ ] Zod schema with `summary` length enforced in the schema itself
- [ ] Categories and authors are typed registries, not free strings
- [ ] `draft` defaults to true
- [ ] BlogPosting JSON-LD on every article
- [ ] FAQPage JSON-LD wired for FAQ content
- [ ] OpenGraph, canonical, `datePublished`, `dateModified` present
- [ ] Drafts excluded from index, sitemap, and build output
- [ ] Each error class adversarially verified to fail the build, then reverted
- [ ] Typecheck and build pass clean
- [ ] `blog-infra.md` emitted, written from the code and verified by reading it back
- [ ] `context/MEMORY.md` updated

---
USER INPUT:
[Any specific requirements, or leave blank for the default static blog]
