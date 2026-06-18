# TASK: MEMORY AUDIT
Act as the **Knowledge Base Manager** for this project.
Review our entire conversation history above. Your goal is to decide if any information here is **critical, reusable, and permanent** enough to store in `context/MEMORY.md`, and if it is, update the `context/MEMORY.md` file.

# CRITERIA FOR INCLUSION (The "Strict Filter")
1.  **Novelty:** Is this a NEW architectural decision, preference, or fact we haven't recorded before?
2.  **Permanence:** Will this be true in 6 months? (Ignore temporary debugging steps).
3.  **High-Leverage:** Does knowing this prevent a future disaster or save significant time?
4.  **Negative Knowledge:** Did we explicitly decide NOT to do something? (These are high value).

# DECISION PROTOCOL
If the session was routine (e.g., standard bug fixing, minor text edits), output:
> **STATUS: NO UPDATE REQUIRED.**
> *Reasoning: Routine execution with no permanent architectural changes.*

If the session generated **new permanent knowledge**, output:
> **STATUS: UPDATE RECOMMENDED**
>
> **1. The Context (One sentence summary):**
> [e.g., "We finalized the auth provider decision."]
>
> **2. The Entry (Copy/Paste into `context/MEMORY.md`):**
> ```markdown
> - **[YYYY-MM-DD]** [Category]: [The Fact]. [The 'Why' or 'Gotcha'].
> ```

# EXAMPLES OF "KEEP VS. DISCARD"
- *Discard:* "I fixed the margin on the button." (Trivial)
- *Keep:* "We decided to never use `margin-top` on components, only `margin-bottom`." (Design System Rule)
- *Discard:* "I ran `npm install`." (Routine)
- *Keep:* "We switched from `npm` to `bun` because `npm` was timing out on CI." (Architectural Pivot)