# Cognitive Strategies Library
*Copy-paste these blocks into your Tasks to give the agent "superpowers".*
*Select only the strategies relevant to the specific task.*

---

## 1. Input & Validation (The "Gatekeeper")

### Strategy: The Gatekeeper (Stop & Ask)
*Use when:* The request might be vague, incomplete, or ambiguous.
*Placement:* Top of "Workflow Steps".

> **PROTOCOL: Gap Analysis & Inquiry**
> Before generating any plan or code, you must perform a **Gap Analysis**:
> 1.  Identify any missing requirements (e.g., edge cases, error handling, platform specifics).
> 2.  **IF** critical information is missing:
>     * **STOP** immediately.
>     * Output a list of 3-5 specific clarifying questions to the user.
>     * **DO NOT** proceed until these are answered.
> 3.  **ELSE**: Proceed with the workflow.

---

## 2. Design & Option Generation (The "Explorer")

### Strategy: The Explorer (Divergent Thinking)
*Use when:* Designing new features, architecture, or when the "best" way isn't obvious.
*Placement:* Before "Workflow Steps" or inside "Design Phase".

> **PROTOCOL: Divergent Thinking**
> Do not lock onto the first solution you find.
> 1.  Generate **3 Distinct Approaches** to solve this problem (e.g., "Fastest", "Safest", "Most Scalable").
> 2.  List the Pros/Cons of each approach.
> 3.  Select the best approach and explicitly justify why it wins.

---

## 3. Structural Planning (The "Architect")

### Strategy: The Architect (Decomposition)
*Use when:* The task involves multiple files, systems, or steps (Complexity > 5).
*Placement:* Before "Workflow Steps".

> **CONSTRAINT: Atomic Decomposition**
> You cannot execute a large plan at once.
> 1.  Break the solution into **Atomic Units** (steps that can be implemented and committed independently).
> 2.  Order them by dependency (Base -> Dependent).
> 3.  Execute only one unit at a time to minimize context drift.

---

## 4. Scoping & Filtering (The "Pareto Filter")

### Strategy: The Pareto Filter (80/20)
*Use when:* Refactoring, Optimization, or MVP planning.
*Placement:* Inside "Constraints".

> **CONSTRAINT: The Pareto Principle**
> You are forbidden from fixing/optimizing everything.
> 1.  Identify the **20% of the code** (the "Hot Path") that drives **80% of the complexity/value**.
> 2.  Focus your changes *only* on that critical 20%.
> 3.  Explicitly ignore low-value edge cases or stable legacy code unless critical.

---

## 5. Style & Consistency (The "Historian")

### Strategy: The Historian (Pattern Matching)
*Use when:* Adding code to an existing module or writing standard UI/Backend logic.
*Placement:* Inside "Constraints" or "Role".

> **CONSTRAINT: Precedent Adherence**
> Do not invent new patterns. "Do as the Romans do."
> 1.  Find 2 existing files in the codebase that solve a similar problem.
> 2.  Extract their patterns (naming, error handling, structure, library usage).
> 3.  Strictly mimic these patterns in your new code.

---

## 6. Logic Verification (The "Simulator")

### Strategy: The Simulator (Mental Sandbox)
*Use when:* Writing complex algorithms, state machines, or debugging tricky logic.
*Placement:* Middle of "Workflow Steps" (Before coding).

> **STEP: Mental Simulation**
> Before outputting the final code, run a **Step-by-Step Mental Simulation**:
> 1.  Initialize state with sample variables (e.g., `i=0`, `user=null`).
> 2.  Walk through your proposed logic line-by-line.
> 3.  **IF** the state drifts from the expected outcome, **discard** the plan and retry.

---

## 7. Safety & Risk (The "Red Team")

### Strategy: The Red Team (Adversarial)
*Use when:* Security reviews, Architecture proposals, or Critical infrastructure changes.
*Placement:* End of "Workflow Steps".

> **STEP: Self-Critique (Red Teaming)**
> Switch persona to "The Attacker." Try to break your own plan.
> 1.  Identify 3 potential failure modes (e.g., race conditions, scale limits, malicious input).
> 2.  Verify that your plan explicitly mitigates these risks.
> 3.  If unmitigated, revise the plan immediately.

---

## 8. Quality Measurement (The "Quantifier")

### Strategy: The Quantifier (Scoring)
*Use when:* Auditing code, Triaging issues, or assessing "readability".
*Placement:* Inside "Output Template".

> **OUTPUT: Confidence Score (0-100)**
> Provide a confidence score for your solution based on verification.
> * **< 70**: "I am guessing/inferring; manual review required."
> * **> 90**: "I have verified this against the codebase/docs."
> * **Metric Breakdown**: [Readability: X/100], [Safety: Y/100], [Performance: Z/100].

---

## 9. Autonomous Research (The "Scout")

### Strategy: The Scout (Context Gathering)
*Use when:* Working in unfamiliar code, integrating with existing systems, or any task where acting on assumptions is risky.
*Placement:* Top of "Workflow Steps" (after Gatekeeper, before planning).

> **PROTOCOL: Autonomous Context Gathering**
> Do not plan or code based on assumptions. Ground yourself in facts first.
> 1.  **Map the territory**: Read related files, trace call chains, check types and interfaces that your change will touch.
> 2.  **Find prior art**: Search for existing implementations of similar functionality in the codebase. If it already exists, use or extend it — do not rebuild.
> 3.  **Check external references**: Consult documentation, changelogs, or READMEs for libraries and APIs you will interact with.
> 4.  **Summarize what you found** in 2-3 sentences before proceeding. If your understanding conflicts with the task description, raise it immediately.

---

## 10. Incremental Validation (The "Ratchet")

### Strategy: The Ratchet (Validate & Adapt)
*Use when:* Multi-step implementations, refactors, or any change where silent failures compound.
*Placement:* Inside "Workflow Steps" (wrap each Atomic Unit from the Architect).

> **PROTOCOL: Incremental Checkpoint Loop**
> Never execute a full plan without intermediate validation.
> 1.  After completing each Atomic Unit, **verify it works** (run tests, check types, confirm expected output).
> 2.  **IF** verification fails:
>     * Diagnose the **root cause** before retrying. Do not repeat the same action hoping for a different result.
>     * If the failure reveals a flaw in the plan, **revise remaining steps** before continuing.
> 3.  **IF** you encounter unexpected state (unfamiliar files, surprising behavior):
>     * **Investigate** before overwriting. It may be intentional or in-progress work.
> 4.  Only proceed to the next unit after the current one is validated. Each passing step is a **ratchet** — you never roll back past a known-good state.

---

## 11. Output Framing (The "Narrator")

### Strategy: The Narrator (Communication Design)
*Use when:* Delivering results, explaining tradeoffs, or any output the user must act on.
*Placement:* End of "Workflow Steps" or inside "Output Template".

> **PROTOCOL: Structured Communication**
> Lead with the answer. Support with evidence. Respect the user's time.
> 1.  **Lead with the outcome**: What was done, what changed, what the user needs to know *first*.
> 2.  **Separate "what I did" from "what you need to decide"**: If there are open questions or tradeoffs, list them explicitly — do not bury decisions inside explanations.
> 3.  **Match depth to stakes**: A one-line config change needs one line of explanation. An architecture decision needs context, alternatives considered, and rationale.
> 4.  **Define "done"**: State what was completed, what was deliberately left out, and what the logical next step is.