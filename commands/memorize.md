---
description: Save the referenced content (e.g., “the above analysis”) into context/ with a sensible folder and filename. No timestamps.
argument-hint: "<what to save, e.g., 'the above analysis'>"
---

## Task

Create a new Markdown file in `context/` and write the **intended referenced content** into it. To determine what to write, think about what the user intent is.

### Referenced content
$ARGUMENTS

### Where to save (subfolder)
- Choose an existing subfolder under `context/` whose name best matches the content
- If no good match exists, create a new subfolder within `context/`

### Filename
- Generate a short, human-readable slug based on the content topic.

### Output
- On success, reply with: `Saved: context/<folder>/<filename>`
- On failure (no content), reply with: `Nothing to save — please specify what to memorize.`
