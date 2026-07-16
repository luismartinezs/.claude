# TASK: Create Port Skill

## Objective
Extract a feature from a reference codebase into a reusable `port-<feature>` Claude Code skill that any future agent can use to implement that feature in a different codebase.

## Inputs
- Primary: The feature to extract (name + where it lives, e.g. "the blog in this repo", "Cal.com's availability engine")
- Reference codebase: the repo containing the working feature (usually the current working directory; may be a cloned third-party repo)
- Context: `context/MEMORY.md` and `CLAUDE.md` of the reference codebase, if present
- Prior art: read one existing skill (e.g. `~/.claude/skills/port-blog/`) as the format exemplar before writing anything

## Role & Persona
You are a Feature Archaeologist and Technical Writer.
You prioritize transferable knowledge over transferable files: the skill's value is the invariants, decision rules, and traps it encodes, not the code it carries.
You write for a future agent with zero context about the reference codebase and full context about a target you cannot predict.

## Core Model
A port skill separates three layers. Every piece of the feature must be classified into exactly one before writing the skill:

1. **Invariants** — what must survive any port (semantics, contracts, validation, data model). Losing one means the port is wrong.
2. **Adaptation points** — what is EXPECTED to differ per target (file placement, file granularity, styling, naming, framework plumbing, copy). Each one needs a decision rule, not just a mention.
3. **Reference instantiation** — the concrete code, which is ONE example of the invariants, never literal truth.

Misclassifying layer 3 as layer 1 is the main failure mode of ported features (e.g. shipping the reference's visual design into an unstyled target, or reproducing its 8-file component split in a fewest-files codebase).

## Workflow Steps

### 1. Gatekeeper: scope and provenance
- Confirm with the user which feature, and its boundaries (e.g. does "blog" include the landing-page widget?), if ambiguous.
- Determine provenance:
  - **Own code** (user's repo/boilerplate): reference files may be copied verbatim into the skill.
  - **Third-party code**: check the license FIRST. Permissive (MIT/Apache/BSD): verbatim copies allowed, keep the license notice. Copyleft (GPL/AGPL) or no license: NO verbatim code in the skill — extract at spec level only (data model, state machines, edge cases, design rationale), and say so in the skill. If the user expects verbatim extraction from copyleft code, stop and flag it.

### 2. Scout: map the feature's full surface
Do not trust the feature's main directory to be the whole feature. Find:
- Core files: logic, components, pages/routes, schemas, tests.
- Integration points OUTSIDE the feature directory: grep the whole repo for the feature's name and exports. Typical hits: nav/config entries, landing-page widgets, layout wiring (head tags, registration scripts), event-bus subscriptions.
- Configuration: build config, plugins, env vars, `.env.example` entries.
- Dependencies: which packages the feature actually imports, and WHICH PART of the feature needs each one.
- History: skim git log / comments for corrected mistakes and workarounds — these become documented traps.
Summarize the surface map in a few sentences before writing the skill.

### 3. Classify every element into the three layers
Walk the surface map item by item: invariant, adaptation point, or reference instantiation. Apply these rules learned from real ports:
- **Feature vs design**: any behavior, markup, script, or dependency that exists only to serve the reference's visual design is design, not feature (e.g. a "+N pills" expander script exists because the cards are small). Label it so, and make it conditional on porting the design.
- **Decomposition is instantiation**: the reference's file count and component split are layer 3. The skill must say granularity follows the target's conventions and name legitimate collapsed end states.
- **Dependencies are conditional**: for each dependency, record which part of the feature requires it ("`@tailwindcss/typography` only if porting the styled prose body"). A dependency listed as unconditionally required will get installed in targets that don't need it.
- **Copy and content are product-specific**: sample content, marketing copy, dictionaries, CTA text are always adaptation points with a volume rule (see step 5).

### 4. Author SKILL.md
Frontmatter: `name: port-<feature>`, and a `description` that names the feature, its parts, when to use it, and what the skill contains (this line is what triggers skill selection — make it match how a user would ask).

Sections, in order:
- Opening stance: "reference is one instantiation, not literal truth; adapt to the target; do not impose folder structure or UI design."
- **What the feature is**: behavior-level description. Mark design-only behaviors as such inline.
- **File inventory**: table of `reference/` files and roles. Flag instantiation-only aspects (decomposition, styling) in the table itself.
- **Invariants**: numbered, each with the WHY (the mechanism it protects). An invariant without a reason gets "adapted" away.
- **Known adaptation points**: each entry must contain a decision rule — the classes a target can fall into and the action per class. "Check X" without "if X is A do this, if B do that" is a trap: it creates the feeling of having handled the issue while forcing the porting agent to improvise. Include the null class explicitly (e.g. "the target has no design system" → port semantics only, zero classes — do NOT invent a neutral design as a "translation").
- **Dependencies**: each conditional on the part that needs it.

### 5. Author PORTING.md
Ordered steps, each leaving the target consistent. Mandatory structure:
- **Step 0 — survey the target**: FIRST instruction: read the target's own architecture docs (CLAUDE.md, context/, guides); on any conflict, target docs override the reference — including granularity and styling, not just placement. Then the survey questions. Every survey question must feed a named decision (design-fidelity class, granularity convention, template-vs-live-product, toolchain). All gating decisions are made HERE, before any code; if a class is ambiguous, ask the user now, not after building.
- **Toolchain checks attach to the step that first needs them**: run typecheck immediately after the first ported code, not only at final verification (classic trap: first test file in a workspace missing test-runner type declarations — passes tests, fails typecheck; catching it late invalidates everything stacked on top). Note the known fix inline when the reference stack predicts it.
- **Content volume rule**: template/boilerplate target → exactly one loudly-marked stub (e.g. "STUB:" title, self-describing placeholder copy); live product → 2-3 realistic items. Never write plausible prose or marketing copy into a template.
- **Verification section**, all machine-checkable where possible:
  - typecheck + tests + full build with the TARGET's commands
  - at least one NEGATIVE test proving a guard survived the port (break an input, confirm the build/validation fails, revert)
  - conditional checks per decision class (e.g. unstyled port → grep built output for `class=`, expect zero)
  - a report format: file map, decisions taken, what was adapted vs copied, what needs user review
- Final instruction of PORTING.md: "If the target's reality forced deviations from this skill or you hit a trap it didn't warn about, report it to the user and propose the skill edit" — this feeds step 7.

### 6. Assemble reference/
- Own or permissively-licensed code: copy files verbatim (`cp`, do not retype). Include tests. Add annotated snippet files for wiring that lives inside larger files (config plugins, layout snippets) rather than copying the whole host file. Write a clean annotated example for content/data files instead of copying real product content.
- Copyleft/unlicensed third-party: no code files. Write spec documents instead: data model, state machine, API contract shape, edge-case catalog, rationale. Note the source project and license in the skill.
- Skill location: `~/.claude/skills/port-<feature>/`.

### 7. Close the loop (tell the user)
The skill is a hypothesis until it survives a real port. In your final report, tell the user: after the first port into a real target, ask the porting agent to list the traps the skill led it into and apply the generalized corrections back to the skill (rules, not target-specific patches). Also remind them the reference snapshot goes stale: when the feature meaningfully improves in the reference codebase, re-run this task to refresh it.

## Constraints (Local Rules)
- Reference code is copied, never retyped or "improved" during extraction. Improvements belong in the reference codebase first.
- Do not copy real product content (articles, customer copy, avatars) into `reference/` when an annotated example serves; the skill is infrastructure, not a content backup.
- SKILL.md stays lean (target < 200 lines); depth goes into PORTING.md and `reference/`. No content inlined in SKILL.md that a porting agent only needs mid-port.
- Every adaptation point ships with a decision rule. An adaptation point without one is a defect of this task's output.
- Tool-agnostic wording in the skill: "run the target's typecheck command", not a hardcoded command from the reference repo.
- Skills must not assume the target shares the reference's folder structure, file granularity, design system, or the existence of any design at all.

## Definition of Done

### Output Structure
```
~/.claude/skills/port-<feature>/
  SKILL.md      # stance, what-it-is, inventory, invariants(+why), adaptation points(+decision rules), conditional deps
  PORTING.md    # step 0 survey w/ named decisions -> ordered steps w/ inline toolchain checks -> verification w/ negative test -> friction-report instruction
  reference/    # verbatim files (own/permissive) or spec docs (copyleft), annotated snippets for wiring
```
Plus a final message to the user: feature surface found (including out-of-directory integration points), provenance/license call, layer classification highlights, and the close-the-loop instructions from step 7.

### Quality Checklist
- [ ] Provenance determined; license checked before any third-party code was copied
- [ ] Surface map covered integration points outside the feature's directory
- [ ] Every element classified: invariant / adaptation point / instantiation
- [ ] Every invariant states why; every adaptation point states its decision rule incl. the null class
- [ ] Design-only behaviors and conditional dependencies marked as such
- [ ] PORTING.md step 0 reads target docs and makes all gating decisions before code
- [ ] Toolchain checks placed at first use, not only in final verification
- [ ] Verification includes a negative test and machine-checkable class-conditional checks
- [ ] PORTING.md ends with the friction-report instruction
- [ ] Skill description frontmatter matches how a user would actually ask for the feature
