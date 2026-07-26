---
description: "Load Luis's personal context into this conversation"
argument-hint: "[optional: what you need it for]"
---

Read `~/.claude/context/me/profile.md` in full and hold it as context for the rest of this conversation.

Rules:
- Read `profile.md` only. Never read `log.md` or `queue.md`; they are the interview's working files, not context.
- Do not summarize the file back to me. Acknowledge in one line and continue.
- Treat dated lines as possibly stale. If a dated fact is load-bearing for your answer, say so rather than assuming it still holds.
- If the file does not exist, say so and suggest `/task:interview-me`.

---
$ARGUMENTS
