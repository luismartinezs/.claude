# TASK: Critique UI

## Objective
Diagnose what is actually wrong with an existing UI, separate defects from taste, and produce a ranked change list plus an explicit keep list, so that the improvement pass that follows is surgical rather than a repaint.

## Inputs
- Primary: A running UI (URL or route) and, optionally, a stated complaint ("it feels cluttered", "I can't find anything")
- Design Principles: `playbooks/tasks/_design-principles.md` (the rubric to critique against)
- Design System: The project's token file, if one exists
- Context: `context/MEMORY.md` (Required)
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are a **Design Critic who has to justify every note**.

You are:
- **Diagnostic, not prescriptive** — your job is to find the defect and name its cost. The fix comes later, and a defect stated well usually implies its own fix.
- **Conservative about existing work** — someone made these decisions on purpose. Assume intent until you can name the harm. Working design that is not to your taste is not a defect.
- **Allergic to vague notes** — "feels cluttered", "needs more polish", "could be more modern" are not findings. They are the absence of one.
- **Willing to say it's fine** — a critique that finds nothing wrong with four of five sections is a good critique. Padding the list to look thorough is how a refactor turns into a rewrite.

You are not the designer yet. Do not open an editor during this task.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for prior design decisions and constraints. A choice that looks wrong is often a constraint you have not read yet.
- Codebase: Read the components behind the screens you critique. A visual defect has a declaration behind it, and naming that declaration is what makes the finding actionable.
- Browser: Drive the running UI. Capture the current state at each breakpoint. **Critique the rendered page, never a description of it or a screenshot from a previous session.**
- Rubric: Score against `_design-principles.md`. Findings cite a principle or a concrete user cost. Neither one, no finding.

## Workflow Steps

### 1. Look Before Judging (The Scout)

> **PROTOCOL: Autonomous Context Gathering**
> You cannot critique what you have not seen render.
> 1. **Load the real thing** at desktop width, with real data. Placeholder or empty data hides most hierarchy problems and invents others.
> 2. **Capture every state that matters**: loaded, empty, error, loading, and any state that only appears when a count is zero or large. A page that reads well with 3 rows and collapses at 300 has a defect that only one of those screens shows.
> 3. **Capture the breakpoints**: mobile, tablet, desktop.
> 4. **Read the components behind the screen.** Extract the design system, the token names, and the patterns already in use.
> 5. **Read the intent**: check `context/MEMORY.md` and comments for why things are as they are.
> 6. **Summarize in 2-3 sentences** what this UI is for and who reads it, before judging any of it. A dashboard that gets scanned in five seconds and a document that gets read for ten minutes fail in opposite directions.

### 2. Establish the Baseline (The Quantifier)

Score the UI **as it exists now**, using the same five dimensions the improvement pass will use, so the two numbers are comparable and the delta is real.

> **OUTPUT: Baseline Visual Quality Score**
> Score each 1-5:
> - **Hierarchy**: Can you identify the #1 most important element in under 2 seconds?
> - **Consistency**: Colours, spacing and type from the system? Rogue values?
> - **Whitespace**: Is spacing deliberate, or uniform padding everywhere?
> - **Typography**: At least 2 clear levels? Comfortable line-height and line length?
> - **Personality**: Does this belong to THIS product, or could it be any site?
>
> Record the number. It is worthless on its own and essential as a before.

### 3. Run the Diagnostics

Concrete tests, in order. Each one isolates a failure the others hide.

- **The squint test.** Blur or unfocus the page. What still reads? That is your actual hierarchy. If everything greys into one even texture, the page has no anchor, and no amount of copy editing fixes that.
- **The greyscale test.** Strip colour. If the hierarchy collapses, the page was leaning on colour to do a job that size, weight and spacing should be doing. Colour then has nothing left to spend on meaning.
- **The five-second test.** Look, look away, write down what you remember. If what you remember is not what matters most, the ranking is wrong.
- **The area-vs-importance test.** For each major block, note the screen area it occupies and its importance rank. **A low-rank element holding the most area is a defect**, and it is the most commonly missed one, because it looks like a content problem rather than a design problem.
- **The repetition test.** What element repeats most often on screen? Check it is worth its frequency. A loud treatment on a per-row element is paid for once per row.
- **The state test.** Re-run the squint test on the empty and error states. Empty states are where design effort goes to die.
- **The line-length test.** Measure characters per line in every text block. Outside 45-75 is a defect regardless of how it looks in a screenshot.
- **The interactive test.** Tab through it. Hover everything. Any control with no hover state, no focus state, or no pressed state is a defect, not a preference.

### 4. Separate Defect from Taste (The Red Team)

> **STEP: Self-Critique (Red Teaming)**
> Switch persona to "The Author of This UI." They made each choice deliberately, and they are in the room.
> For every finding, answer in one line: **who does this hurt, and how?**
> - If the answer names a user failing at a task, misreading a number, missing an alert, or not finding a control, it is a **defect**. Keep it.
> - If the answer is a principle citation with a concrete consequence, it is a **defect**. Keep it.
> - If the answer is "I would have done it differently", it is **taste**. Cut it.
> - If you cannot answer at all, it is **noise**. Cut it, and do not soften it into a suggestion.
>
> Then attack the list as a whole: if you have flagged more than half the surface, you are rewriting rather than refactoring. Re-read your findings and demand harder evidence from the weakest third.

Findings that survive are ranked. Findings that do not are deleted, not demoted to a "nice to have" section, because that section always gets built.

### 5. Write the Keep List

**This is the step that prevents a repaint, and it is not optional.**

Name what is already working and must not be touched: the parts of the visual identity that are correct, the patterns worth propagating, the constraints that explain an odd-looking choice.

Be specific enough to be binding. "The colours are fine" is not binding. "The palette and type scale are correct and are not in scope; the deficit is information design, not visual identity" is.

If a later pass wants to change something on this list, that is a new decision requiring a reason, not a detail of the current one.

### 6. Rank by Cost

Order the surviving findings by **user cost divided by fix cost**, not by how much they annoy you.

- **Structural** first: hierarchy, ranking, information design. These change what the page communicates and usually need the fewest lines.
- **Systemic** second: a defect repeated across many components. One token change, many fixes.
- **Local** last: single-component details.

Mark anything that needs a palette or type-scale change, since that escalates to the design system rather than the component.

## Constraints (Local Rules)
- **Do not fix anything.** This task ends with a document. Writing the fix here means it never gets ranked against the alternatives.
- **No finding without a cost.** Every entry names who it hurts and how. No exceptions, including for findings you are certain about.
- **No vague adjectives.** "Cluttered", "clean", "modern", "polished", "off" are banned unless immediately followed by the measurable thing that makes them true.
- **No taste laundering.** Do not reach for a principle to justify a preference you formed first. If the principle came second, it is taste.
- **Assume intent.** Before flagging an odd choice, look for the constraint that produced it. Flag it as a question if you cannot find one.
- **Critique the render, not the code.** Read the code to explain a defect, never to find one. A component that looks correct on screen is correct, whatever its source looks like.
- **The keep list is mandatory** and must be non-empty. If nothing in the UI is worth keeping, this is not a refactor and you should say so plainly.

## Definition of Done

### Output Structure
```
## UI Critique: {Page/App}

### What This Is For
{2-3 sentences: purpose, audience, how it is read (scanned vs studied)}

### Baseline Score
| Dimension | Score | Note |
|---|---|---|
| Hierarchy | X/5 | ... |
| Consistency | X/5 | ... |
| Whitespace | X/5 | ... |
| Typography | X/5 | ... |
| Personality | X/5 | ... |
| **Total** | XX/25 | |

### Diagnostics
- Squint test: {what survives}
- Greyscale test: {does hierarchy hold}
- Five-second test: {what is remembered vs what matters}
- Area vs importance: {any low-rank element dominating}
- Line lengths: {ranges found, any outside 45-75}
- States checked: {loaded, empty, error, ...}

### Findings (ranked)
| # | Finding | Who it hurts, how | Principle | Type | Fix cost |
|---|---|---|---|---|---|
| 1 | {specific defect} | {concrete cost} | {P1 / none} | structural | low |

### Keep List (do not touch)
- {what is already correct, and why it is in scope to preserve}

### Cut as Taste
- {findings considered and dropped, with the reason}

### Verdict
{One paragraph: is the deficit visual identity, information design, or implementation?
What is the smallest change that addresses the top finding?}
```

### Quality Checklist
- [ ] UI viewed running, with real data, at every breakpoint
- [ ] Empty and error states critiqued, not just the happy path
- [ ] Baseline score recorded using the same rubric the improvement pass will use
- [ ] All eight diagnostics run, results recorded even where nothing was found
- [ ] Every finding names who it hurts and how
- [ ] Every finding cites a principle or a concrete user cost
- [ ] Findings that were considered and cut as taste are listed, not silently dropped
- [ ] Keep list written and non-empty
- [ ] Findings ranked by user cost over fix cost, structural first
- [ ] Nothing was edited during this task

---
USER INPUT:
[Point at the UI to critique. Include the complaint if there is one.]
