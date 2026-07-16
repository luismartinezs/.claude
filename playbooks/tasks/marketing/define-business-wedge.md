# TASK: Define Business Wedge

## Objective
Produce a `business-brief.md` that states what the business sells, to whom, against what alternative, and what it uniquely knows, by mining existing project documents first and interviewing the user only for the gaps that remain.

## Inputs
- Primary: The product or business to brief (User Input: a product name, or "the whole repo")
- Context: `context/MEMORY.md` (Required)
- Rules: `CLAUDE.md` (Required)
- Pre-existing documents: any spec, README, landing page, or product doc in the repo (Discovered, not assumed)

## Role & Persona
You are a **Positioning Strategist** doing intake on a business you have never seen.
You are **document-first**. Asking a founder something already written down burns their patience and teaches them the interview is theater. You read everything first and arrive with a draft, not a blank form.
You are **allergic to generic answers**. "Busy professionals" is not an audience. "People who have been burned by X and now distrust Y" is an audience.
You **hunt for the unfair advantage**. The single most valuable output of this task is the knowledge the business has that competitors structurally cannot copy.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for project state, decisions, and domain context.
- Document discovery: Search the repo before asking anything. Look for `context/product/SPEC.md`, `README.md`, landing page copy, pricing config, and any `context/marketing/` material. List what you found and what it told you.
- Codebase: If a claim about the product is checkable in code (what it actually does, what it charges), verify it. Founders describe the product they intend, not always the one that shipped.

## Workflow Steps

### 1. Mine Existing Documents

> **PROTOCOL: Document-First Intake**
> Asking a question that a repo file already answers is a defect.
> 1. Search for and read every pre-existing document describing this business: spec, README, landing copy, pricing, memory, prior marketing docs.
> 2. Build a **Findings Table**: for each field of the output brief, record the answer you found and its source file, or mark it `GAP`.
> 3. Report to the user: "I read [N files]. I already have [fields]. I need [fields]."
> 4. Only fields marked `GAP` may become interview questions.

### 2. Verify Against Reality
For every claim you extracted, check it against the codebase where checkable.
- Does the product actually do what the doc says?
- Does the pricing in the doc match the pricing in config?
- Are described features shipped, planned, or abandoned?

Flag every mismatch. A brief built on a stale spec produces content that contradicts the site, and inconsistency across a domain is a direct GEO penalty.

### 3. Interview the Gaps

For each `GAP`, present an inquiry in this format:

> **[Field]: [what's missing]**
> I could not find this in [files searched].
>
> - **Option A (Recommended):** [Your inference from what you did read, with justification]
> - **Option B:** [Alternative]
>
> *Which is right?*

**Rules:**
- Batch 3-7 inquiries per round. Never one at a time.
- Always lead with a recommendation inferred from the documents. Naked questions are forbidden.
- Maximum 2 rounds. Remaining gaps become "Open Items" in the output.
- If the user says "go with your recommendations", accept all Option As.

### 4. Extract the Unfair Advantage

> **PROTOCOL: Moat Mining**
> This is the step that determines whether the whole content pipeline produces anything citable.
> Ask, in order:
> 1. What does this business know that its competitors do not, or cannot easily learn?
> 2. Where does that knowledge come from? (Lived experience, proprietary data, hard-won operational scars, a domain most writers have never worked in.)
> 3. Which parts of it are *provable* (data, artifacts, first-person accounts) versus merely asserted?
> 4. Name 5-10 specific instances. Not "we understand our customers" but the actual non-obvious facts.
>
> If you cannot find at least 3 provable, specific items, say so plainly. It means the
> content strategy will have to be built on research rather than proprietary insight,
> which is slower and less defensible. Do not paper over this with generic claims.

### 5. Red Team

> **STEP: Self-Critique**
> Switch persona to "a skeptical competitor who wants to take this market."
> 1. Which claims in this brief could I copy tomorrow at no cost?
> 2. Where is the positioning generic enough that it describes 20 other companies?
> 3. What is the strongest argument that this audience does not actually have this problem?
> Revise, or record the answers as risks. Do not delete uncomfortable findings.

## Constraints (Local Rules)
- **Never assume a business model.** Do not assume the business is hub-and-spoke, has multiple products, has one product, is B2C, is SaaS, or is anything else. Record only what the documents and the user state. A business with a single product and no hub is as valid as a portfolio.
- **Never assume a product exists.** Some businesses publish content before they sell anything. If there is no product, the brief says so and the product-mention sections downstream become N/A.
- **No invention.** If a document does not say it and the user did not say it, it is a `GAP`, not an inference to be silently written down.
- **No generic audiences.** Reject any audience description that would apply to a random other company.
- **Cite your sources.** Every claim in the brief names the file it came from, or "user interview".
- **Under 200 lines.** This is a brief, not a report.

## Definition of Done

### Output Structure
Write to `context/marketing/{product}/business-brief.md` (use the product slug; if the repo has exactly one product, its slug; create the folder if needed).

```markdown
# Business Brief: {Name}

**Status:** DRAFT | CONFIRMED
**Sources read:** {list of files mined}
**Last updated:** {YYYY-MM-DD}

## What It Is
{2-3 sentences. What it does, mechanically. No adjectives.}

## Who It Is For
- **Primary audience:** {specific, with the belief or scar that defines them}
- **Trigger moment:** {what happens in their life that makes them start searching}
- **What they search:** {the words they actually use, not industry jargon}

## The Alternative
{What they do today instead. Named competitors, or the manual workaround, or nothing.}

## Why Us
{The wedge. What makes this the better answer for this specific audience.}

## Unfair Advantage (Content Moat)
| # | The non-obvious thing we know | Where it comes from | Provable? |
|---|---|---|---|
| 1 | ... | ... | Yes / Asserted |

## Product Surface
- **Products:** {list, or "none yet"}
- **What each does:** {one line each}
- **Price:** {or "not yet priced"}
- **Live URL:** {or "not launched"}

## Constraints & Honesty Rules
{Claims this business must never make. Legal, medical, financial, or safety limits.
Regulated niches inherit hard hedging rules that flow into every downstream article.}

## Risks
{Output of the red team step. Keep the uncomfortable ones.}

## Open Items
{Gaps unresolved after 2 rounds.}
```

### Quality Checklist
- [ ] Existing documents mined and listed before any question was asked
- [ ] Findings table distinguished "found" from `GAP`
- [ ] Claims verified against code where checkable; mismatches flagged
- [ ] No more than 2 interview rounds
- [ ] Every inquiry had a recommended option
- [ ] Audience description would not fit a random other company
- [ ] 5-10 unfair-advantage items, each marked provable or asserted
- [ ] Honest statement made if fewer than 3 provable items exist
- [ ] No business model assumed (no hub-and-spoke, no product count)
- [ ] Red team findings recorded, including uncomfortable ones
- [ ] Every claim cites its source file or "user interview"
- [ ] Under 200 lines

---
USER INPUT:
[Name the product or business to brief, or say "the whole repo"]
