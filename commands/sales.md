---
description: Start or continue a supervised sales pipeline run (playbooks/sales-v1). Args: <slug> [reply, notes, pasted replies or call notes]
---

Arguments: $ARGUMENTS

The first word is SLUG. Everything after it is the owner's input: on a new run, notes; on an
existing run, a reply to the waiting packet, a pasted prospect reply, call notes, or a report that
something was sent, booked, signed or paid.

Follow /home/luis/dev/playbooks/sales-v1/instructions.md. If
`~/claymore/sales-v1/<SLUG>/run.json` exists, continue that run (`status` and `due` first);
otherwise start a new run.
