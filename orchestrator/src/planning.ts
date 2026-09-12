// The planning phase, which is the same for every project and therefore built
// in rather than read from a file. It runs before docs/ladder.json exists, and
// its last rung is what writes that file.
//
// The modes are the point. Refining a spec and answering the decisions are
// conversations, so those rungs hand you a real session and wait. Everything
// between them is mechanical and runs headless.

import { LADDER_PATH, Ladder, cardPath } from "./schema";
import { PLAN_PATH } from "./plan";

const PLAYBOOKS = `${process.env.HOME}/.claude/playbooks/tasks`;

const task = (rel: string) => `${PLAYBOOKS}/${rel}`;

export const planningLadder = (project: string, branch: string): Ladder =>
  Ladder.parse({
    project,
    branch,
    push: false,
    // Every planning rung writes a document. None of them has a milestone card
    // to read or to close out, which is what `meta` says.
    rungs: [
      {
        id: "P0",
        name: "spec",
        milestones: ["spec"],
        mode: "interactive",
        converse: "Tell it what you are building. It asks until nothing is ambiguous.",
        maxAttempts: 1,
        prompt: [
          `Follow the task at ${task("product/refine-spec.md")}.`,
          "",
          "There is no draft yet. Open by asking what we are building, in one or",
          "two sentences, then run the inquiry loop on the answer. Keep asking",
          "until nothing in the spec could be read two ways.",
          "",
          "Write the result to docs/spec.md. Do not commit.",
        ].join("\n"),
        oracle: { kind: "command", run: "test -s docs/spec.md" },
      },
      {
        id: "P1",
        name: "plan",
        milestones: ["plan"],
        prompt: [
          `Follow the task at ${task("engineering/plan-milestones.md")}, with`,
          "docs/spec.md as the input.",
          "",
          "Every mechanical check must be a command that exits non-zero when its",
          "milestone is not done. A check that prints a number for a human to read",
          "is not one, because nobody will be watching. M0 owns the verify harness",
          "the later checks hang off.",
          "",
          "Write docs/plan.md. Do not commit.",
        ].join("\n"),
        oracle: { kind: "command", run: "test -s docs/plan.md" },
      },
      {
        id: "P2",
        name: "decisions",
        milestones: ["decisions"],
        mode: "interactive",
        converse: "Review the check commands, then answer at most five product decisions.",
        maxAttempts: 1,
        prompt: [
          `Follow the task at ${task("product/route-decisions.md")}, with`,
          "docs/plan.md and docs/spec.md as the input.",
          "",
          "Anything wrong with the plan's checks is yours to fix, quietly, in",
          "docs/plan.md, before you ask him anything. A check that is identical to",
          "another milestone's cannot tell the two apart, so make each one name",
          "what it measures. Never ask him about a check. Reviewing them would",
          "mean reading the plan, which is the exact cost this whole thing exists",
          "to avoid.",
          "",
          "Then ask him the decisions, one at a time, with your recommendation,",
          "and record his answers in docs/decisions.md. Every question must be",
          "answerable by someone who has read nothing: no milestone ids, no file",
          "names, no commands, no vocabulary borrowed from the plan. Ask about",
          "what the product does, who it is for, what it refuses to do, and what",
          "it costs. If answering would need him to open a file, the question is",
          "yours to decide, not his.",
          "",
          "Ask nothing else. Do not commit.",
        ].join("\n"),
        oracle: { kind: "command", run: "test -s docs/decisions.md" },
      },
      {
        id: "P3",
        name: "cards",
        milestones: ["cards"],
        prompt: [
          `Follow the task at ${task("engineering/write-milestone-card.md")} in`,
          "author mode, once per milestone, up to and including the taste boundary",
          "named in docs/plan.md. Later cards are written when their milestone",
          "arrives.",
          "",
          "Apply anything Luis decided in docs/decisions.md. A card must be",
          "implementable without opening docs/spec.md. Do not commit.",
        ].join("\n"),
        oracle: { kind: "command", run: "test -s docs/milestones/M0.md" },
      },
      {
        id: "P4",
        name: "runbook",
        milestones: ["runbook"],
        prompt: [
          `Follow the task at ${task("engineering/write-runbook.md")}, with`,
          "docs/plan.md and the cards as input.",
          "",
          "Emit both outputs: docs/runbook.md and docs/ladder.json. The ladder is",
          "the one that will actually run, so its rungs must match the runbook's in",
          "id and order, its prompts carry the work line only, and every command",
          "oracle must exit non-zero when its milestone is not met. A milestone that",
          "only a person can close gets a human oracle, which is the honest answer.",
          "",
          "Do not commit.",
        ].join("\n"),
        oracle: {
          kind: "command",
          run: "test -s docs/ladder.json && bun -e 'JSON.parse(await Bun.file(\"docs/ladder.json\").text())'",
        },
      },
    ].map((rung) => ({ ...rung, kind: "meta" })),
  });

// --- growing the ladder ----------------------------------------------------

// Built when the rungs run out before the plan does. One session: it writes
// the next milestone's card, if the rung before it did not, and then puts that
// milestone on the ladder.
//
// A session rather than a regex, because both questions it answers are
// judgements. Whether the milestone can have a command oracle at all is one.
// Whether its card puts a human read in the middle, and so needs two rungs
// rather than one, is the other. Getting either wrong is how a ladder marches
// past a milestone it never measured.
export const extendLadder = (base: Ladder, next: string, previous?: string): Ladder => {
  // The card before this one is where every defect found in the plan so far
  // was recorded, and it is the reason this card was not written earlier.
  const evidence = previous
    ? `   ${cardPath(previous)}, where every defect found in the plan so far`
    : `   the cards already written, where every defect found so far`;

  return Ladder.parse({
    ...base,
    rungs: [
      {
        id: `X${next}`,
        name: `put ${next} on the ladder`,
        milestones: [next],
        kind: "meta",
        prompt: [
          `${next} is the next milestone in ${PLAN_PATH} and no rung in ${LADDER_PATH}`,
          `covers it. Put it on the ladder. Do not implement it.`,
          ``,
          `1. If ${cardPath(next)} does not exist, author it now, following`,
          `   ${task("engineering/write-milestone-card.md")}. Its inputs are the`,
          `   ${next} block in ${PLAN_PATH}, docs/decisions.md, and the Notes of`,
          evidence,
          `   was recorded. If the card already exists, the rung before it wrote`,
          `   it while it still held the evidence. Read it and leave it alone.`,
          ``,
          `2. Append the rung, or rungs, for ${next} to ${LADDER_PATH}, and the`,
          `   matching session to docs/runbook.md so the two cannot drift. Match`,
          `   the shape of the rungs already there and continue their id series.`,
          `   Do not touch, reorder or renumber any rung already in the file:`,
          `   every one of them has been built and tagged, and the ids are in`,
          `   the git history.`,
          ``,
          `One rung, unless the card itself puts a human read in the middle of the`,
          `milestone. Then it is two, and the split goes exactly where the card`,
          `puts the read, so that nothing downstream of it is authored before it`,
          `is approved.`,
          ``,
          `The oracle is the honest answer and not the convenient one. A command`,
          `oracle must exit non-zero when ${next} is not done, and must not be`,
          `identical to another rung's, or neither rung can tell its own`,
          `milestone from the other's. If the card's done-condition is Luis's`,
          `judgement, the oracle is human: its \`ask\` is what he is being asked to`,
          `look at, in one or two sentences, and its \`artifact\` is the file he`,
          `opens. A human oracle means the orchestrator never runs a command for`,
          `this rung, so any mechanical floors the milestone has go in the rung's`,
          `own prompt instead, as commands the session runs itself before it`,
          `parks, along with the instruction to form no opinion about the result.`,
          ``,
          `Then stop. Writing ${next}'s card and its rung is the whole job.`,
        ].join("\n"),
        oracle: {
          kind: "command",
          run:
            `test -s ${cardPath(next)} && bun -e '` +
            `const l = JSON.parse(await Bun.file("${LADDER_PATH}").text()); ` +
            `if (!l.rungs.some((r) => r.milestones.includes("${next}"))) ` +
            `{ console.error("no rung covers ${next}"); process.exit(1) }'`,
        },
      },
    ],
  });
};
