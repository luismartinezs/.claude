- The benefit of every `bun install` must heavily outweight its cost, to earn its place
- Prefer vanilla TS over frameworks where possible.
- Functional Purity: No classes. Pure functions only. Zod for validation.
- No em-dashes (—) in content copy, marketing text, or user-facing writing. Use periods, commas, or restructure the sentence instead. Em-dashes are an obvious AI tell.

### How to Explain Things to Me

Applies to every explanation you write for me: chat answers, reports, docs, PR
bodies, and the "why" comments in code. Not to code itself, and not to commit
messages. Derived from a blind A/B test I ran on your own output, so these are
measured preferences, not guesses. English is my working language and has been
for 15 years, so do not simplify vocabulary. The rules below are about
structure and reference, not about word difficulty.

1. **Orient before you reason.** The first sentence names the subject and says
   what it is and why it exists. Never open with "the drill" or "the worker" or
   "the handler" and explain later. If I have to ask "what X?", the text failed
   at sentence one.
2. **Always include the supporting numbers and values, inline, in
   parentheses.** Plain language carries the meaning, the precise term rides
   alongside it: "the server stopped waiting for the file (HTTP 408)", "the
   library fixes the number at 8 (`@sanity/import` hardcodes
   `ASSET_UPLOAD_CONCURRENCY = 8`)". I want the exact string I could paste into
   a search box, so do not drop a value to make the sentence read easier.
   This rule covers values only: numbers, error codes, setting and constant
   names, package names, versions, flags. It does not cover locations, because
   a file path, a line number or a function name tells me where to look rather
   than what is true, and those follow "How to Structure" rule 3 instead and go
   in the detail section.
3. **Literal verbs only.** No figurative or abstract phrasing. "The worker buys
   an option", "its options were lifted from", "this unlocks", "surface area"
   all stop me cold. Say the physical action: "the worker lets us set the
   number", "the settings were copied from".
4. **State the causal link, do not imply it.** Use because, so, which means,
   therefore. A run of short disconnected sentences is harder for me than one
   longer sentence with explicit connectives, because disconnected sentences
   make me reconstruct the causality myself.
5. **Name the noun instead of using a pronoun**, whenever a sentence has more
   than one candidate object. "It", "that", "one" force me to search backward
   and I lose the thread. Also pick one name per object and keep it for the
   whole text. Do not call the same thing the uplink, then the pipe, then the
   connection.
6. **Announce a count, then number the items.** "Two requirements" must be
   followed by a list numbered 1 and 2. Same for actions, which go in a
   numbered list in the order I should do them. This rule sets how a list is
   formatted once I have one; "How to Structure" rule 6 decides whether the
   content should be a list at all.
7. **No metaphors.** Pipes, knobs, slices, buckets. A metaphor adds a second
   object I have to map back onto the real one.

Sentence length is not the problem and short sentences are not the fix. Unnamed
subjects, dangling pronouns, and implied logic are the problem.

Before, which I could not follow:

> The drill needed control over how many uploads run at the same time. The
> library underneath the tool fixes the number at 8. One route remains. The
> library can be called directly from a small script. The worker therefore buys
> an option that has not yet been needed.

After, which I could:

> The disaster recovery drill is a script that restores a production backup into
> a spare Sanity project, so that we know a backup can be turned back into a
> working site. The drill needed control over how many images upload at the same
> time (asset concurrency), but the Sanity command line tool has no setting for
> it, and the library underneath fixes the number at 8 (`@sanity/import`
> hardcodes `ASSET_UPLOAD_CONCURRENCY = 8`), so the only way to change the
> number is to call that library directly from our own script. That script is
> what `dr-import-worker.mjs` is. The cost is that we now maintain code which
> repeats what one command already did, and we have not yet needed the setting
> that code gives us.

### How to Structure an Explanation

Applies to the whole response, not the sentence. Measured, same as the rules
above: three layouts tested twice against real codebase content.

**When this shape applies.** Use it when the answer carries reasoning I have to
follow before I can agree with it: a recommendation, a diagnosis, a review, a
plan, a trade-off. Skip it for direct answers, status reports, confirmations and
anything whose honest answer is short, roughly under 150 words. A two-sentence
answer stays two sentences.

**Default shape, in this order.** 1) The recommendation or finding, in one
sentence. 2) The situation, in plain language. 3) The options and why one wins.
4) What has to happen first. 5) Urgency, when something expires or blocks other
work. 6) A detail section, last.

Section 1 changes name by task: "what changed" after an edit, "the cause" for a
bug, "the recommendation" for a proposal. The order never changes. Drop any
section that has nothing real in it rather than padding it, because a section
written to satisfy the shape costs me the same reading effort as a section that
says something and returns nothing.

1. **Lead with the action to take, never with a negation.** "Don't do X" is
   unreadable when X is a term I do not hold yet. Name the rejected option only
   after the situation has established what the problem is.
2. **Every technical noun gets a plain-language gloss at first use, in the same
   sentence.** A `file:line` citation is a pointer, not an explanation. Writing
   `SpriteRegistry.ts:150` tells me where to look and nothing about what happens
   there. If I would have to open a file to parse a sentence, the sentence is
   broken.
3. **The body stays at the level of what the system does and what I would do.**
   Function names, line numbers, file paths and arithmetic go in the detail
   section. Inline citations inside conceptual prose slow me down and I stop
   reading.
4. **Start every paragraph with a bolded lead-in naming what it answers.**
   "Where the rotation happens", "Why 8 and not 32". A paragraph without one is
   measurably harder for me than the same paragraph with one.
5. **When supporting detail exists, write it into the detail section instead of
   offering to fetch it.** Asking costs a round trip and skipping the section
   costs me nothing, so assume I skip it and write it anyway. If the answer has
   no supporting detail, there is no detail section.
6. **Numbered list for ordered steps or for a set whose count I announced.
   Bullets only for genuinely parallel items.** A sequence of actions is a
   numbered list even though each step depends on the one before it, because
   the numbers carry that order. Everything else that relates causally goes in
   prose with because/so/which means, since a bulleted list of causally related
   facts reads to me as a list of unrelated facts.
7. **Findings outside what I asked go at the end of the detail section**, one
   line each.

**Length is not the constraint. Decoding effort is.** When an explanation is
genuinely needed, do not compress it by deleting the glosses in rule 2 or the
lead-ins in rule 4, because a longer response I read once beats a shorter one I
have to reconstruct. That is permission to keep a real explanation whole, not
permission to inflate a short answer into a long one.

### Git

Never `git commit` or `git push` on your own. Stage/inspect as needed, but wait
for explicit permission before creating commits or pushing. This applies even
after the user says "deploy it" or "ship it" — those mean "do the code work",
not "commit on my behalf", unless they explicitly say "commit and push".

### Playbooks (Tasks & Workflows)

My reusable task and workflow library lives at `~/.claude/playbooks/`. A **task** is
one job with a fixed schema (Objective / Inputs / Role & Persona / Integration /
Workflow / Constraints / Definition of Done). A **workflow** chains tasks, each step
emitting a file that feeds the next.

**Resolution: local first, then global.** When I name a task or workflow (e.g.
"run compose-workflow", "use plan-feature"), resolve it in this order:

1. `playbooks/{tasks,workflows}/**/<name>.md` in the current project
2. `~/.claude/playbooks/{tasks,workflows}/**/<name>.md`

First hit wins. A project copy always overrides the global one. Read the file on
demand when the task is invoked. Never preload the library.

Global holds what is project-agnostic: the framework (`_template.md`,
`_strategies.md`, `tasks.spec.md`), all of `meta/`, and my standard-stack
engineering, product, and ops tasks. Projects keep only genuinely
project-specific tasks locally. If a global task needs an edit that would only
suit one project, that is a signal to copy it local, not to fork global.

Grounding is per project: tasks read `context/MEMORY.md` and `CLAUDE.md` relative
to the project root. Architecture doctrine is global and lives at
`/home/luis/claymore/coding/vertical-slice-architecture.md`.

Legacy note: some repos still carry a full local `playbooks/` predating this split. Local-first means they keep
working untouched. Do not migrate one unless I ask.

### Code Intelligence

Prefer LSP over Grep/Glob/Read for code navigation:
- `goToDefinition` / `goToImplementation` to jump to source
- `findReferences` to see all usages across the codebase
- `workspaceSymbol` to find where something is defined
- `documentSymbol` to list all symbols in a file
- `hover` for type info without reading the file
- `incomingCalls` / `outgoingCalls` for call hierarchy

Before renaming or changing a function signature, use
`findReferences` to find all call sites first.

Use Grep/Glob only for text/pattern searches (comments,
strings, config values) where LSP doesn't help.

After writing or editing code, check LSP diagnostics before
moving on. Fix any type errors or missing imports immediately.

### Legibility Pass (code rot from agentic work)

Applies to every feature or bugfix task where you edit code. The goal is narrow:
make the code cheaper for the next agent to understand, so future sessions spend
fewer tokens re-deriving what something does. This is not classic refactoring
(DRY, SOLID). It targets AI-legibility rot: spots where you burned effort because
the code was unclear, undocumented, or missing context.

Capture the signal in the moment, not at the end. When you have to read a
pre-existing file three or more times, or you cannot tell what a function does
without tracing it by hand, that is rot. Note it when it happens.

Before declaring the task done, resolve each flagged spot:

- **Tier 1, legibility (safe, no behavior change).** Fix it in place now. Add a
  comment that explains the *why* (not the what), clarify a confusing name, or
  add/extend a co-located `AI-CONTEXT.md`. Keep edits limited to code you already
  touched for the task. This is where most of the value is.
- **Tier 2, structural (changes the shape of the code).** Do NOT edit as a
  drive-by. Append one line to `.claude/refactor-backlog.md` at the repo root, in
  the form `file:line | what was confusing | suggested fix`. Mention it in your
  final message and offer to run a dedicated refactor pass on it later.

If nothing rotted, or the edits were trivial, say nothing. No filler, no
manufactured findings. A Stop hook reminds you of this pass whenever a session
edited code, so it does not depend on you remembering.

### Google Calendar

Use the "Claude Tasks" calendar for scheduling actions, reminders, and deadlines.
- Calendar ID: `515eca68a9a433d17d4b58f8c51d1fd2dd1ea29e1dcfd33fd6e43c94bb1345dc@group.calendar.google.com`
- Timezone: Asia/Bangkok
- Do NOT put events on Luis's personal or "schedule" calendars. Only use "Claude Tasks".

