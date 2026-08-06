---
description: Run a task playbook by name. No name lists the library.
argument-hint: <task-name> [input for the task]
---

The first token below is the task name. Everything after it is the task's input.

Resolve the file, first hit wins:
1. `playbooks/tasks/**/<name>.md` in the current project
2. `~/.claude/playbooks/tasks/**/<name>.md`

Then read the resolved file **in full** and execute it, treating the remaining arguments as its input.

Rules:
- If no name was given, list the available task names from both trees and stop.
- If the name does not resolve, say so and list the closest matches. Never substitute a different playbook and never improvise the task from its name alone.
- Names are unique per tree. `audit-security` exists as both a task and a workflow; this command always means the task.

---
$ARGUMENTS
