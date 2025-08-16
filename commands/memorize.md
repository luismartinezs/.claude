---
description: Save the referenced content (e.g., “the above analysis”) into memory-bank/ with a sensible folder and filename. No timestamps.
argument-hint: "<what to save, e.g., 'the above analysis'>"
---

## Task

Create a new Markdown file in `memory-bank/` and write the **intended referenced content** into it. To determine what to write, think about what the user intent is.

### Referenced content
$ARGUMENTS

### Where to save (subfolder)
- Choose an existing subfolder under `memory-bank/` whose name best matches the content
- If no good match exists, create a new subfolder within `memory-bank/`

### Filename
- Generate a short, human-readable slug based on the content topic.

### Output
- On success, reply with: `Saved: memory-bank/<folder>/<filename>`
- On failure (no content), reply with: `Nothing to save — please specify what to memorize.`
