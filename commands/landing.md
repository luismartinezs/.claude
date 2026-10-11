---
description: Start or continue a supervised landing page run (playbooks/landing-page-v3, the active version). Args: <slug> [notes or reply]
---

Arguments: $ARGUMENTS

The first word is SLUG. Everything after it is Luis's input: on a new run it is his notes
(the SEED); on an existing run it is his reply to the waiting gate or review, or new notes.
Images he attaches or mentions go in the run's `notes/`.

Continue an existing run with the version that made it:

- `~/claymore/landing-page-v3/<SLUG>/run.json` exists: follow
  /home/luis/dev/playbooks/landing-page-v3/instructions.md.
- `~/claymore/postma-landing/<SLUG>/run.json` exists: follow
  /home/luis/dev/playbooks/landing-page-v2/instructions.md.
- `~/claymore/landing/<SLUG>/state.md` exists: follow
  /home/luis/dev/playbooks/landing-page-v1/instructions.md.

If more than one exists, ask which run he means. If none exists, start a new run with the
active version, /home/luis/dev/playbooks/landing-page-v3/instructions.md.
