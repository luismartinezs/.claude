---
description: Write a layman-friendly briefing that explains the current situation in plain English.
---

Write a plain-English knowledge-transfer document about: $ARGUMENTS

If no topic is given, brief the current work: whatever we have been doing in this
conversation, this codebase, or this project.

Purpose: the reader is smart but not steeped in the technical detail. Your normal way of
communicating is dense and jargon-heavy. This document is the opposite. Its job is to make
the reader *understand the overall picture*, not to be complete.

Rules:

1. **Optimize for one-read comprehension by a layman.** No jargon without an immediate
   plain-English translation. Prefer a short story or concrete example over an abstract
   description. If a smart friend with no background could not follow a sentence, rewrite it.
2. **Big picture over detail.** Answer three questions clearly: where are we, what are we
   doing, and what are we aiming toward. Skip exhaustive detail; it is fine to leave things
   out. Completeness is not the goal; understanding is.
3. **Be honest, not promotional.** Include the real risks, the things that could kill it,
   and what we do not yet know. A briefing that only lists good news is useless.
4. **Structure for skimming.** Short sections with clear headings. Lead with a
   one-sentence summary. Use lists where they help.
5. **No em-dashes.** Use periods, commas, or restructure. This is user-facing writing.
6. **Write it to a markdown file**, do not just print it in chat. Default location: a
   `drafts/` or `docs/` folder in the current project (create it if needed), named
   descriptively (e.g. `briefing-<topic>.md`). If the user named a path, use it. Date the
   document.

After writing, tell the user the file path and give a two-line summary of what it covers.
Do not restate the whole document in chat.
