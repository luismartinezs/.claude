---
description: Review the code you touched this session for AI-legibility rot and fix it
argument-hint: "[optional: files or area to focus on]"
---

Run the legibility pass over the code edited in this session. The goal is narrow:
make the code cheaper for the next agent to understand, so future sessions spend
fewer tokens re-deriving what something does. This is not classic refactoring
(DRY, SOLID). It targets the spots where you burned effort because the code was
unclear, undocumented, or missing context.

The signal is what actually happened during the session: a pre-existing file you
had to read three or more times, a function whose behavior you could not
determine without tracing it by hand, a constant whose value you had to hunt for.

Resolve each such spot:

- **Tier 1, legibility (safe, no behavior change).** Fix it in place now. Add a
  comment explaining the *why* (not the what), clarify a confusing name, or
  add/extend a co-located `AI-CONTEXT.md`. Keep edits limited to code you already
  touched for the task.
- **Tier 2, structural (changes the shape of the code).** Do not edit. Append one
  line to `.claude/refactor-backlog.md` at the repo root, in the form
  `file:line | what was confusing | suggested fix`, and mention it in your reply.

If nothing rotted, or the edits were trivial, say so in one line and stop. No
filler, no manufactured findings. Reporting "nothing rotted" is the correct and
common outcome for a small change.

---
$ARGUMENTS
