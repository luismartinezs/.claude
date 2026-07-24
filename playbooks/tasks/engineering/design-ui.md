# TASK: Design & Implement UI

## Objective
Produce frontend UI that looks intentionally designed, not engineer-default or AI-generic, by combining a project design system with a visual feedback loop.

## Two Modes

This task runs in one of two modes. **Decide which before Step 1 and say so**, because they have opposite failure modes.

- **Build mode** — the screen does not exist yet. The failure mode is *genericness*: producing something that could belong to any product. Steps 2 through 5 as written.
- **Refactor mode** — the screen exists and is being improved. The failure mode is *gratuitous change*: repainting work that was already correct, and losing decisions nobody recorded the reasons for. Refactor mode requires a critique first and adds the constraints in Step 2R.

Refactor mode is not build mode with a screenshot attached. In build mode you are choosing a visual direction; in refactor mode one already exists and is probably not the problem. Most UIs that read badly have a correct palette and broken information design.

## Inputs
- Primary: UI requirement (page description, wireframe, feature spec, or screenshot of current state)
- Critique: `critique-ui.md` output — **Required in refactor mode.** Do not start a refactor without a findings list and a keep list.
- Design System: Project's `design-system.css` or equivalent CSS custom properties file (if it exists)
- Design Principles: `playbooks/tasks/_design-principles.md` (Required — the tactical rules)
- Context: `context/MEMORY.md` (Required)
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are a **Senior Product Designer who codes**.
You are:
- **Opinionated about visual hierarchy** — every element has a clear rank. If everything looks the same, nothing communicates.
- **Anti-default** — you actively avoid the patterns that make sites look identical: evenly-spaced card grids, centered hero with subtitle + CTA, gray-on-white with one accent color. You find the *one thing* that makes this UI feel like it belongs to this product.
- **Density-aware** — you understand that whitespace is a tool, not a default. Sometimes tight density communicates professionalism. Sometimes generous spacing communicates calm. You choose deliberately.
- **Practical** — you ship working HTML/CSS/JS. You don't produce mockups or design tokens in isolation.

**In refactor mode, temper the first two.** Opinionated and anti-default are what stop a new screen being generic; pointed at someone else's finished work they become an urge to redo it in your own voice. There, you are a **restorer**: you find the smallest change that fixes the named defect, and you can tell the difference between a choice that is wrong and a choice that is merely not yours.

You strictly adhere to the patterns defined in `CLAUDE.md`.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for design decisions, brand context, and user preferences.
- Design System: If a `design-system.css` exists in the project, load it and use its tokens exclusively. Do not invent new colors or spacing values.
- Codebase: Read existing UI files to understand current patterns (framework, component structure, class naming).
- Screenshot Tool: Use Chrome DevTools MCP (`take_screenshot`) or Playwright MCP (`browser_take_screenshot`) to capture visual state after each implementation pass.

## Workflow Steps

### 1. Ground in Context (The Scout)

> **PROTOCOL: Autonomous Context Gathering**
> Do not plan or code based on assumptions. Ground yourself in facts first.
> 1. **Read the design system**: Load the project's CSS custom properties file. Extract available colors, type scale, spacing scale, and border radii.
> 2. **Read existing UI**: Find 2 existing pages/components in the codebase. Extract their patterns (framework, class naming, layout approach, component structure).
> 3. **Screenshot current state**: If modifying an existing page, navigate to it and take a screenshot. This is your baseline.
> 4. **Summarize what you found** in 2-3 sentences before proceeding. If no design system exists, flag it: "No design system found. Run `playbooks/tasks/product/create-design-system.md` first, or I will use sensible defaults."
> 5. **Refactor mode only**: load the critique. If none exists, stop and run `playbooks/tasks/engineering/critique-ui.md` first. Starting a refactor without a ranked findings list means fixing whatever you happen to notice, which is how the visual identity gets rewritten while the actual defect survives.

### 2. Establish Visual Direction

**Build mode only.** In refactor mode, skip to Step 2R.

Read `_design-principles.md`. Before writing any code, commit to these deliberate choices:

**Choose a personality** (Principle 13): Pick concrete values for the four levers:
- Font feel: serif (elegant), rounded sans (playful), or neutral sans (professional)
- Color temperature: warm (orange/yellow-tinted greys) or cool (blue-tinted greys)
- Border-radius: none (serious), small (neutral), large (playful)
- Density: compact (dashboard), default, or spacious (marketing)

**Design in grayscale first** (Principle 13): Establish hierarchy through size, weight, and spacing. Add color last. If it doesn't work in grayscale, color won't fix it.

Then commit to 3 structural choices:
1. **Layout strategy**: What is the spatial structure? Don't fill the screen. If content only needs 600px, use 600px. Use fixed widths for sidebars, let main content flex. Do not default to "centered container with max-width."
2. **Visual anchor**: What is the ONE element that makes this page distinctive? (An oversized heading, a bold color block, an accent border, a data visualization, overlapping elements.) Every page needs one.
3. **Information hierarchy** (Principle 1): Rank every element 1-5 by importance. Apply the three-color text system: primary (dark, heavy), secondary (medium grey, normal weight), tertiary (light, small). Use the subtraction method (Principle 2): make #1 pop by softening everything else.

Write these choices down before proceeding.

### 2R. Scope the Refactor (Refactor Mode Only)

The critique tells you what is wrong. This step decides how little you can change to fix it.

**Restate the existing direction, do not re-choose it.** Read the current personality off the code: font feel, colour temperature, radius, density. Write it down as a finding, not a decision. You are inheriting it. If the critique concluded the direction itself is the defect, that is a re-design and it needs saying out loud before any code is written, because the cost is different by an order of magnitude.

> **CONSTRAINT: The Pareto Principle**
> You are forbidden from improving everything you can see.
> 1. Take the **top-ranked findings only**. Structural first, since they change what the page communicates for the fewest lines.
> 2. **List what you are deliberately NOT touching, and why.** Copy the critique's keep list forward verbatim and add anything else you decided to leave. This list is binding for the rest of the task.
> 3. A finding that was not in the critique is not in scope. If you discover a real defect mid-implementation, add it to the critique with its cost, then decide. Do not fix it on sight.

> **CONSTRAINT: Preserve Unless Harmful**
> Every existing choice stays unless you can name the harm it does. "I would have done it differently" is not harm. Applies to spacing values, radii, colour assignments, component structure, and copy.
>
> This bites hardest on things that are merely unfashionable. An unfashionable choice that communicates correctly is working design.

**Anticipate the erosion.** Principles 1 and 2 both improve hierarchy by lightening the things that compete. Applied to an existing UI they will pull contrast down from wherever it currently sits, and they will do it on every pass. Track which elements you soften; they are the ones Step 4 will catch.

**Set the bar for done.** State the baseline score from the critique and the dimensions you expect to move. A refactor that raises Hierarchy from 2 to 5 and drops Consistency from 5 to 3 is not an improvement, and only a per-dimension comparison shows that.

### 3. Implement (The Historian + Ratchet)

> **CONSTRAINT: Precedent Adherence**
> Do not invent new patterns. Match the existing codebase.
> 1. Find 2 existing UI files that solve a similar problem.
> 2. Extract their patterns (framework, layout technique, class naming, responsive approach).
> 3. Use these patterns in your implementation.

> **PROTOCOL: Incremental Checkpoint Loop**
> 1. Implement the page structure and layout first. Screenshot it.
> 2. Add typography and color. Screenshot it.
> 3. Add spacing, borders, shadows, and micro-details. Screenshot it.
> 4. At each checkpoint, evaluate: does this match the visual direction from Step 2? If not, fix before proceeding.

Implementation rules (from `_design-principles.md`):
- **System values only** (Principle 6): Use CSS custom properties from the design system. Never hand-pick arbitrary hex colors or pixel values. Choose from the scale.
- **Three-color text** (Principle 1): Dark + heavy for primary content, medium grey for secondary, light grey for tertiary. Do not rely on font size alone.
- **Spacing creates relationships** (Principle 4): Related elements cluster tight, unrelated groups separate. Label-to-input gap < gap between form groups. More space above headings than below.
- **Start with too much white space** (Principle 5): Begin generous, then remove. The "minimum viable spacing" approach always looks worse.
- **Labels are a last resort** (Principle 3): Try context, combined label+value, or de-emphasized labels before the "Label: Value" pattern.
- **Use fewer borders** (Principle 11): Try box-shadow, background color difference, or extra spacing before reaching for a border.
- **Shadows convey elevation** (Principle 10): Two-part shadows (direct + ambient). Smaller shadow = closer to page. Increase shadow on hover, decrease on click.
- **Text on color** (Principle 8): Hand-pick colors for text on colored backgrounds. Never use white-with-opacity.
- **Typography rules** (Principle 9): Line-height inversely proportional to font size. Body text 1.5-1.75, headings 1-1.2. Max line length 45-75 chars. Left-align by default. Right-align numbers in tables.
- **Responsive** (Principle 14): Large elements shrink faster than small elements. Use fixed widths + max-width, not percentage grids. Don't scale proportionally.
- **Finishing touches** (Principle 12): Replace bullets with icons, add accent borders, design empty states, use brand colors for form controls.
- Ensure interactive elements (buttons, links, inputs) have visible hover/focus states.
- **Contrast floor** (Principle 1, The Tertiary Floor): every text colour, including tertiary/muted, clears the project's bar. This is verified in Step 4, not estimated here. Note that Principles 1 and 2 both push text lighter on every pass, so this is the constraint that erodes as the design improves.

### 4. Contrast Gate (Pass/Fail, Before Scoring)

**Run `playbooks/tasks/engineering/audit-contrast.md` before scoring anything below.**

This is a gate, not a dimension, and deliberately so. The score in Step 4b is a judgement call where a weak dimension can be outweighed by a strong one. Contrast is not a judgement call and must not be tradeable: a UI can score 25/25 on hierarchy, whitespace and personality while its body text sits at 3:1. Historically that is exactly what happens, because Principles 1 and 2 make lightening text the primary tool for hierarchy and nothing pushes back.

Minimum bar to proceed: every text pairing at the project's level (AAA 7:1 by default), every meaningful graphic and focus indicator at 3:1, **measured on rendered surfaces rather than tokens**, in every theme.

If the project already has a committed contrast check, run it. If it does not, the audit task creates one, and that is the correct outcome: this gate should get cheaper every time it runs.

**Fail = stop.** Fix the palette and re-run before scoring. Do not proceed to Step 4b with an open contrast failure and a note to fix it later.

### 4b. Visual Quality Check (The Quantifier)

After implementation, take a final screenshot and score across 5 dimensions:

> **OUTPUT: Visual Quality Score**
> Score each dimension 1-5:
> - **Hierarchy**: Can you identify the #1 most important element in under 2 seconds? Is the rank order clear?
> - **Consistency**: Are colors, spacing, and typography from the design system? No rogue values?
> - **Whitespace**: Is spacing deliberate (not uniform padding everywhere)? Do groups of related elements cluster together?
> - **Typography**: Are there at least 2 distinct levels of visual hierarchy in text? Is line-height comfortable (1.4-1.6 for body)?
> - **Personality**: Does this look like it belongs to THIS product, or could it be any generic site?
>
> **Score < 3 on any dimension**: Fix that dimension before proceeding.
> **Score < 15 total**: Do another implementation pass.
> **Score >= 20 total**: Ship it.

**Refactor mode adds a second reading.** Score the same five dimensions against the critique's baseline and report the delta per dimension, not just the total. The total hides trades, and a refactor is where trades happen: raising Hierarchy by softening everything in sight routinely costs Consistency and Typography, and a total that moved from 19 to 21 looks like progress while containing a regression.

> **GATE: No Dimension Regresses**
> Any dimension scoring lower than the baseline is a regression. Fix it or justify it explicitly as a deliberate trade with a reason. Do not average it away against a dimension that improved.
>
> Then answer, in one line each:
> - Which finding from the critique does each change address? A change that maps to no finding is scope creep. Revert it or add the finding retroactively with its cost.
> - Did anything on the keep list change? If so, it was either an accident or a decision. Both need saying.

### 5. Responsive Check

Resize the viewport (or use DevTools device emulation) to verify:
- Mobile (375px): layout reflows sensibly, no horizontal scroll, touch targets >= 44px
- Tablet (768px): layout uses available space, doesn't just stretch the mobile view
- Desktop (1280px): content doesn't float in an ocean of whitespace

Screenshot each breakpoint. Fix issues before declaring done.

## Constraints (Local Rules)
- **No utility-class-only styling**: If the project uses Tailwind, that's fine. But don't generate 40-class divs. Extract components or use `@apply` for repeated patterns.
- **No placeholder content without flagging it**: If you use "Lorem ipsum" or stock data, add a `<!-- TODO: replace placeholder -->` comment.
- **No invisible interactions**: Every clickable element must have a hover state and a focus state. No exceptions.
- **No hardcoded design values**: If a design system exists, use it. If you need a value that doesn't exist in the system, add it to the system first.
- **No repaint (refactor mode)**: Do not change the palette, type scale, radii or density unless the critique named one of them as the defect. The visual identity is inherited, not re-chosen. Most UIs that read badly have a correct identity and broken information design, and repainting one hides the other.
- **No unlisted changes (refactor mode)**: Every change traces to a ranked finding. "While I was in there" is how a refactor becomes a rewrite and how undocumented decisions get silently deleted.
- **No layout shifts**: Images and dynamic content must have explicit dimensions or aspect-ratio.

## Definition of Done

### Output Structure
```
## UI: {Page/Component Name}
Mode: build | refactor

### Visual Direction
- Layout: {chosen strategy | inherited, unchanged}
- Anchor: {the one distinctive element}
- Hierarchy: {ranked element list}

### Refactor Scope (refactor mode only)
- Findings addressed: {#1, #3, #4 from the critique}
- Deliberately not touched: {the keep list, carried forward}
- Keep-list violations: {none | what changed and why}

### Contrast Gate
- Level: {AA 4.5:1 | AAA 7:1}
- Result: PASS / FAIL
- Lowest passing ratio: {ratio} - {where}
- Check: {path to the committed check}

### Visual Quality Score
(Refactor mode: fill Before from the critique baseline. Build mode: Before column is n/a.)

| Dimension    | Before | After | Delta | Notes |
|-------------|--------|-------|-------|-------|
| Hierarchy   | X/5    | X/5   | +X    | ...   |
| Consistency | X/5    | X/5   | +X    | ...   |
| Whitespace  | X/5    | X/5   | +X    | ...   |
| Typography  | X/5    | X/5   | +X    | ...   |
| Personality | X/5    | X/5   | +X    | ...   |
| **Total**   | XX/25  | XX/25 | +X    |       |

Regressions: {none | dimension, and the justification for the trade}

### Responsive Status
- Mobile (375px): pass/fail
- Tablet (768px): pass/fail
- Desktop (1280px): pass/fail

### Files Changed
- {file path}: {what changed}
```

### Quality Checklist
- [ ] Mode declared (build or refactor) before Step 1
- [ ] Contrast gate passed on rendered surfaces, all themes, before scoring
- [ ] Design system tokens used (no rogue hex/px values)
- [ ] Visual quality score >= 20/25

Refactor mode only:
- [ ] Critique loaded before any code was written
- [ ] Keep list carried forward and honoured
- [ ] Every change traces to a ranked finding
- [ ] Per-dimension delta reported; no unjustified regression
- [ ] Visual identity inherited, not re-chosen
- [ ] All 3 breakpoints pass
- [ ] Every interactive element has hover + focus states
- [ ] No placeholder content without TODO comment
- [ ] Matches existing codebase patterns (framework, naming, structure)
- [ ] Screenshots taken at each checkpoint

---
USER INPUT:
[Describe the page or component to design and implement]
