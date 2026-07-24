# Workflow: Build UI

## Starting State
Either a UI requirement for a screen that does not exist yet (page description, feature spec, wireframe), or an existing screen to improve ("make this look better", a specific complaint, or a screenshot).

## End State
UI is designed or improved, contrast-gated, visually verified via screenshots, responsive, and reviewed. Ready to merge. In refactor mode, every change traces to a named defect and the visual identity survives unless it was the defect.

## Two Modes

This workflow covers both building a new screen and improving an existing one. The mode is decided by Step 0 and carried through `design-ui`.

- **Build mode** — nothing exists yet. Step 0 is skipped. The risk is genericness.
- **Refactor mode** — the screen exists. Step 0 is required. The risk is gratuitous change: repainting a visual identity that was already correct while the real defect survives.

Refactor mode is not build mode with a screenshot attached. Most UIs that read badly have a correct palette and broken information design, and the workflow only tells those apart if the critique runs first.

## Tools Discovered
- Tasks: `engineering/critique-ui`, `product/create-design-system`, `engineering/design-ui`, `engineering/audit-contrast`, `engineering/review-code`
- MCP Servers: Chrome DevTools MCP (`take_screenshot`, `navigate_page`, `lighthouse_audit`), Playwright MCP (`browser_take_screenshot`, `browser_navigate`)
- Scripts: `bun run typecheck` (type verification, if applicable)
- Skills: `/frontend-design` (Anthropic official design skill, optional creative boost)
- Gaps: None. Full coverage with existing tasks.

## Why contrast is gated twice

`audit-contrast` appears at two points, and that repetition is deliberate rather than sloppy. They catch different failures:

- **After Step 1** it checks *tokens*, before any component is built on a palette that cannot pass. Cheap to fix here, expensive later.
- **After Step 2** it checks *rendered surfaces*. Components tint backgrounds with `color-mix`, `rgba` and `opacity`, and none of those is a token, so a palette that passed Step 1 can render below the bar. This is the failure that actually ships.

The second run is not optional because the first one passed.

## Steps

0. **Critique the Existing UI**
   - Input: The running UI, plus the complaint if there is one
   - Task: `playbooks/tasks/engineering/critique-ui.md`
   - Output: Baseline visual quality score, ranked findings each with a named user cost, and a **keep list** of what must not be touched
   - Skip condition: Build mode. If the screen does not exist yet there is nothing to critique.
   - Gate: The critique must produce a non-empty keep list and at least one finding with a concrete cost. A critique that flags more than half the surface is a rewrite proposal, not a refactor: say so and get a decision before continuing.

1. **Create Design System**
   - Input: Seed color (hex), font family, density preference
   - Task: `playbooks/tasks/product/create-design-system.md`
   - Output: `design-system.css` with OKLCH color palette, type scale, spacing scale, dark mode
   - Skip condition: If a `design-system.css` (or equivalent CSS custom properties file) already exists in the project, skip to Step 1b.
   - Gate: User confirms the generated palette looks right (screenshot a simple test page using the tokens).

1b. **Contrast Gate: Tokens**
   - Input: The design system from Step 1, or the project's existing token file if Step 1 was skipped
   - Task: `playbooks/tasks/engineering/audit-contrast.md`
   - Output: Every token pairing computed, per theme; failures fixed in the palette
   - Note: Run this even when Step 1 was skipped. An inherited palette has not been verified just because it exists.
   - Gate: All text pairings at the project level (AAA 7:1 by default), focus indicators at 3:1. Fail = fix the palette before building on it.

2. **Design & Implement UI**
   - Input: UI requirement + design system from Step 1. **Refactor mode: plus the critique from Step 0.**
   - Task: `playbooks/tasks/engineering/design-ui.md`, in the mode set at Step 0
   - Output: Working UI code, screenshots at each checkpoint, visual quality score >= 20/25
   - Constraint: Must use design system tokens. No hardcoded colors or spacing.
   - Constraint (refactor mode): Every change traces to a ranked finding. The keep list is binding. The visual identity is inherited, not re-chosen.
   - Gate: Visual quality score passes threshold. If score < 20, iterate within this step until it does.
   - Gate (refactor mode): Per-dimension delta against the Step 0 baseline, with no unjustified regression. A total that improved while a dimension dropped is a trade, and it needs stating rather than averaging away.

2b. **Contrast Gate: Rendered**
   - Input: The running UI from Step 2
   - Task: `playbooks/tasks/engineering/audit-contrast.md`
   - Output: Composited surfaces, interactive states and meaningful graphics measured as the browser paints them; failures fixed; **an executable check committed and wired into the project's runner**
   - Constraint: Measure rendered surfaces, not tokens. A tokens-only result does not satisfy this gate.
   - Gate: All pairings pass, in every theme. Fail = fix and re-run. The committed check is part of the deliverable, not a nice-to-have: it is what stops the next UI pass regressing this one.

3. **Review**
   - Input: Full diff from Step 2
   - Task: `playbooks/tasks/engineering/review-code.md`
   - Output: Scored review with findings
   - Focus areas: Design system compliance (no rogue values), responsive behavior, accessibility (contrast, focus states, touch targets), code pattern consistency
   - Focus areas (refactor mode): also scope discipline. Diff every change against the critique's findings list and keep list. Deletions matter most here: a removed rule, comment or edge-case handler is where an undocumented decision quietly dies.
   - Gate: If score < 70 or Critical findings exist, address them and re-review.

## Gaps & Recommendations
- Contrast now has a dedicated task (`engineering/audit-contrast`), gated at Steps 1b and 2b. The rest of accessibility does not: focus order, keyboard reachability, ARIA, target sizes, heading structure and reduced-motion are still only spot-checked by `review-code`. A separate `engineering/audit-accessibility.md` is the next gap worth filling, and it should stay separate rather than absorbing contrast, since it needs different methods and different evidence.
- No visual regression testing. Currently relies on manual screenshot comparison. If UI work becomes frequent, consider adding a `engineering/visual-regression.md` task that captures baseline screenshots and compares against them.
