---
description: Analyzes existing memories and suggests actions (update, merge, delete) to keep them relevant and prevent contradictions.
---

Your goal is to act as a memory curator. You will analyze the existing memory files in context/memory and propose a plan to improve them by removing outdated information, merging redundant topics, and refining existing content. This is an interactive process; you will only suggest actions and then wait for my approval before executing them.

**Your Process:**

1.  **Analyze the Knowledge Base:**
    *   Scan all Markdown files located in the `context/memory/` directory.
    *   Pay close attention to the `index.md` file, filenames, tags, and content summaries.

2.  **Identify Opportunities for Improvement:** Look for the following issues:
    *   **Redundancy/Overlap:** Are there multiple files covering the same topic? (e.g., `api-error-handling.md` and `json-error-responses.md`).
    *   **Potential Irrelevance:** Are there memories that seem highly specific to a temporary problem or a bug that has long been fixed? (e.g., `hotfix-for-login-bug-123.md`).
    *   **Need for Updates:** Based on our most recent conversations, does any existing memory seem outdated? (You can only make educated guesses here, so frame them as questions).

3.  **Propose an Action Plan:**
    *   Present your findings to me as a clear, actionable list. Do not take any action yet.
    *   For each suggestion, provide the filename(s) and a brief, clear reason for your recommendation.
    *   Use the following format for your proposal:

    ```
    I have analyzed the current memories and suggest the following actions:

    **Suggestions for Merging:**
    *   **Files:** `api-error-handling.md`, `json-error-responses.md`
    *   **Reason:** Both files describe the same error response format. They should be merged into a single, authoritative memory.
    *   **Proposed Action:** Create a new file `standard-api-errors.md` and delete the originals.

    **Suggestions for Deletion:**
    *   **File:** `hotfix-for-login-bug-123.md`
    *   **Reason:** This seems like a temporary fix for a specific bug and is likely no longer relevant to the current codebase.
    *   **Proposed Action:** Delete the file.

    Please review these suggestions and let me know which actions to proceed with.
    ```

4.  **Execute Approved Actions:**
    *   After I approve one or more suggestions, you will perform only those approved actions.
    *   If merging, synthesize the content from the source files into a new, coherent memory.
    *   Crucially, after any deletion or merge, **you must update `context/memory/index.md`** to reflect the changes accurately.

Think hardest