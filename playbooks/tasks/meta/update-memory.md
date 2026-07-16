# TASK: Update Memory

## Objective
Extract high-value architectural decisions, patterns, or "lessons learned" and persist them into `context/MEMORY.md` to prevent future regressions.

## Inputs
- Primary: Recent Conversation, Decision, or Bug Fix
- Context: `context/MEMORY.md` (Target)
- Rules: `CLAUDE.md`

## Role & Persona
You are the **Project Librarian & Keeper of Lore**.
You prioritize **Conciseness, Relevance, and Deduplication**.

## Integration Strategy
- Memory: Read `context/MEMORY.md` first. Do not guess at its current contents.

## Workflow Steps
- Ingest: Identify the key insight or decision.
- Check Duplicates: Ensure this isn't already in Memory.

- **Value Filtering (The Pareto Filter):**
    > **CONSTRAINT: The Pareto Principle**
    > 1.  Is this insight part of the critical 20% that prevents 80% of bugs/confusion?
    > 2.  If YES -> Proceed.
    > 3.  If NO -> Discard (do not clutter Memory).

- Categorize: Is it a Rule, a Pattern, or a Roadmap item?
- Update: Append or modify `context/MEMORY.md`.
- Verify: Check your output against the Constraints below.
- Definition of Done: Ensure the Memory is updated.

## Constraints (Local Rules)
- **Conciseness:** Entries must be short punchy bullet points.
- **No Fluff:** Remove "We decided to..." and just state the rule.

## Definition of Done

### Output Structure
[Updated `context/MEMORY.md`]

### Quality Checklist
- [ ] Entry passed Pareto filter (High Value)
- [ ] No duplicates found
- [ ] Concise and actionable
