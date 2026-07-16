# Workflow: Build UI

## Starting State
A UI requirement exists (page description, feature spec, wireframe, or "make this look better" + screenshot).

## End State
UI is designed, implemented, visually verified via screenshots, responsive, and reviewed. Ready to merge.

## Tools Discovered
- Tasks: `product/create-design-system`, `engineering/design-ui`, `engineering/review-code`
- MCP Servers: Chrome DevTools MCP (`take_screenshot`, `navigate_page`, `lighthouse_audit`), Playwright MCP (`browser_take_screenshot`, `browser_navigate`)
- Scripts: `bun run typecheck` (type verification, if applicable)
- Skills: `/frontend-design` (Anthropic official design skill, optional creative boost)
- Gaps: None. Full coverage with existing tasks.

## Steps

1. **Create Design System**
   - Input: Seed color (hex), font family, density preference
   - Task: `playbooks/tasks/product/create-design-system.md`
   - Output: `design-system.css` with OKLCH color palette, type scale, spacing scale, dark mode
   - Skip condition: If a `design-system.css` (or equivalent CSS custom properties file) already exists in the project, skip to Step 2.
   - Gate: User confirms the generated palette looks right (screenshot a simple test page using the tokens).

2. **Design & Implement UI**
   - Input: UI requirement + design system from Step 1
   - Task: `playbooks/tasks/engineering/design-ui.md`
   - Output: Working UI code, screenshots at each checkpoint, visual quality score >= 20/25
   - Constraint: Must use design system tokens. No hardcoded colors or spacing.
   - Gate: Visual quality score passes threshold. If score < 20, iterate within this step until it does.

3. **Review**
   - Input: Full diff from Step 2
   - Task: `playbooks/tasks/engineering/review-code.md`
   - Output: Scored review with findings
   - Focus areas: Design system compliance (no rogue values), responsive behavior, accessibility (contrast, focus states, touch targets), code pattern consistency
   - Gate: If score < 70 or Critical findings exist, address them and re-review.

## Gaps & Recommendations
- No dedicated accessibility audit task exists. The design-ui task covers WCAG AA contrast and focus states, and review-code checks for issues, but a specialized `engineering/audit-accessibility.md` task could be valuable if accessibility requirements grow.
- No visual regression testing. Currently relies on manual screenshot comparison. If UI work becomes frequent, consider adding a `engineering/visual-regression.md` task that captures baseline screenshots and compares against them.
