---
description: Run a workflow playbook by name. No name lists the library.
argument-hint: <workflow-name> [input for the workflow]
---

The first token below is the workflow name. Everything after it is the workflow's input.

Resolve the file, first hit wins:
1. `playbooks/workflows/**/<name>.md` in the current project
2. `~/.claude/playbooks/workflows/**/<name>.md`

Then read the resolved file **in full** and execute it, treating the remaining arguments as its input. A workflow chains tasks; resolve each task it names by the same local-first rule.

Rules:
- If no name was given, list the available workflow names from both trees and stop.
- If the name does not resolve, say so and list the closest matches. Never substitute a different playbook and never improvise the workflow from its name alone.
- Respect every user gate the workflow declares. Do not run past a gate on your own.

---
$ARGUMENTS
