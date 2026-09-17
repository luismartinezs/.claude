---
name: untangle
description: Forensic review and simplification of one suspiciously-complex subsystem. Use when the user flags code as "suspiciously complicated", asks to review the workings of a feature, or wants to clean up entangled logic without a large refactor. Interactive - the user is a checkpoint at every behavior-affecting decision.
---

# Untangle: forensic subsystem review

A disciplined process for taking one subsystem the user finds suspiciously
complex, separating essential from incidental complexity, and deleting what
does not earn its existence. Work the phases in order. Never skip Phase 4
(archaeology). Never change behavior without a Phase 3 sign-off.

Scope guard: this is a deep pass on ONE subsystem, not a codebase audit and
not a rewrite. "The feature works; the goal is cleanup and simplification,
not large refactors." If the right fix is a big refactor, name it, estimate
it, and park it.

## Phase 1 - Map the territory

- Read the owning file(s) fully. Identify every cross-file touchpoint:
  grep for the subsystem's identifiers (CSS vars, event names, store keys,
  global registrations). Include `public/`, vendored, and config files.
- Output: a table of files and their roles (owner / consumer / fallback /
  comment-only coupling).

## Phase 2 - Model the dataflow

- Write human-readable pseudocode, not prose: INPUTS (what JS/code must
  measure or observe because the platform cannot express it), DERIVED VALUES
  (the math, usually trivial), READERS (who consumes each output), and
  RECOMPUTE-WHEN (the complete list of events that invalidate the derived
  state).
- Identify the core variable(s) forcing the complexity, and trace every
  mechanism back to the constraint it serves (a table: mechanism -> exists
  because). Complexity with no constraint behind it is incidental; flag it.
- The invalidation list is the bug map: any event that changes an input but
  has no listener is a latent stale-state bug. Check for missing entries.

## Phase 3 - Challenge the constraints (with the user)

- For each constraint, ask the user: is this load-bearing (a deliberate
  design/product decision) or an accident? Do not guess. The user often
  knows a reason invisible in the code (e.g. an animation slot, a legal
  requirement).
- Classify proposed changes into tiers:
  - Tier 1: pure refactor, zero behavior change - do without asking.
  - Tier 2: small behavior change, big simplification win - needs explicit
    sign-off, ideally a visual review ("comment it out so I can look").
  - Tier 3: the greenfield redesign - record it as deferred, with the reason.

## Phase 4 - Archaeology before deletion (non-negotiable)

- Before deleting ANY code, even provably-dead code: `git log --follow` on
  the file, `git log -S '<identifier>' --all` for consumers across all
  branches and all history, and check the introducing commit's context
  (initial commit? boilerplate/starter template? a fix for a bug you cannot
  see?).
- "Zero consumers today" + "zero consumers ever, on any branch" + "arrived
  as template boilerplate" = safe to delete. Present-state grep alone is NOT
  sufficient evidence; the user was right to demand this.
- When a bug's root cause is found elsewhere, re-question every defensive
  mechanism added while the cause was unknown. Hardening that guards against
  a now-impossible failure is dead code too. Re-derive the invalidation
  matrix from first principles and delete listeners whose rows are covered
  or vacuous.

## Phase 5 - Investigate anomalies empirically

- Reproduce reported glitches before theorizing. For "state goes wrong then
  fixes itself" bugs, ask: what runs during the broken window, and what runs
  at the moment it self-corrects? The fixer identifies the stale state; the
  breaker is whatever wrote it (or wiped it).
- Hunt external writers of shared resources: other code touching the same
  DOM node, style attribute, global, or store. Grep beyond the subsystem.
  Classic landmine: `setAttribute('style', ...)` / `.cssText =` replacing an
  attribute other components write with `setProperty`.

## Phase 6 - Record the system, not just the fix

- A contract comment at the top of the owning section: the dataflow model
  from Phase 2 (inputs / derived / readers / recompute-when), plus deliberate
  decisions with their reasons ("the fork is intentional because...") so
  future readers do not relitigate or "fix" them.
- Namespace cross-component globals by owner and list them in a single
  registry file (who publishes, who reads, the rule for safe writes).
  Same for z-index ladders and similar cross-file ordering contracts.
- Also record what is deliberately ABSENT ("no window-resize listener is
  needed because...") - absence without explanation gets re-added.

## Phase 7 - Verify and close

- Lint + production build after every batch. Grep for leftovers of renamed
  identifiers (runtime-published names do not fail builds; a missed consumer
  silently falls back).
- Ask the user for a manual visual pass listing the specific combinations to
  check (breakpoints x themes x navigation paths).
- Do not commit or push; leave the working tree for the user's review.
- Write the session's transferable lessons (gotchas, conventions) to the
  user's knowledge vault if available.

## Principles (the spine of the process)

- Code must earn its existence. Write-only values, consumer-less utilities,
  and obsolete hardening are liabilities, not assets.
- Essential complexity traces to a constraint; incidental complexity traces
  to a missing abstraction, a missed event, or history. Sort every mechanism
  into one of the two before touching it.
- Derived state in JS means owning the complete invalidation set. Document
  it; an incomplete set is a bug class, not a style issue.
- Comments should record decisions and contracts, not narrate mechanics.
- The user's "that looks suspicious" and "that must exist for a reason" are
  both signals. Investigate; never bluff either way.
