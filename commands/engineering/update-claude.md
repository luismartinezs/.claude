---
description: Look into changes in the current feature branch, update CLAUDE.md and CHANGELOG.md files accordingly
---

$ARGUMENTS

First check whether we are checked out to a feature branch. If we are checked out to main or another non-feature, abort with message: "We are not checked out to a feature branch", else, continue:

Retrieve all the changes in the current feature branch (the diff vs main) and carefully read them. Then, look for CLAUDE.md and CHANGELOG.md files in the current project, and update them accordlingly, based on the changes. If the files don't exist, create them.

For CHANGELOG.md, adhere to the format used in the current codebase, and default to:

```md
## [x.x.x] - yyyy-mm-dd

- Change described in one short sentence
- Another change
```

For the CLAUDE.md file, make sure to adhere to best practices described here: https://www.anthropic.com/engineering/claude-code-best-practices