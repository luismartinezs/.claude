// What gets pasted into each fresh session, assembled here rather than stored
// in the ladder. The closeout instruction is the load-bearing half of a rung
// and the easiest to lose, so it is appended by code and cannot be edited out
// of an individual rung by accident.

import { cardPath, type Rung } from "./schema";

const cards = (rung: Rung) => rung.milestones.map(cardPath).join(", ");

// A build rung owes its card a closeout. A meta rung is writing a document and
// has no card of its own, so it gets the mailbox and the commit policy and
// nothing about Notes.
const closeout = (rung: Rung) => {
  const which = rung.milestones.length === 1 ? cards(rung) : `each of ${cards(rung)}`;
  const opening =
    rung.kind === "meta"
      ? [
          `Write the file this rung is for, and nothing else. Do not implement a`,
          `milestone and do not touch code that a milestone owns.`,
          ``,
        ]
      : [
          `When the done-condition is met, close out ${which}: measured results next to`,
          `the targets, what landed, and append to Notes what the plan or the spec got`,
          `wrong. Then stop.`,
          ``,
          `If you cannot meet the done-condition, append to Notes what you tried and why`,
          `it failed, then stop without further attempts. A recorded dead end is worth`,
          `more than another guess.`,
          ``,
        ];
  return [
    ...opening,
    `If you hit a decision ${rung.kind === "meta" ? "this rung" : "this card"} cannot settle, one that changes what the`,
    `product is rather than how it is built, do not guess. Write the question to`,
    `docs/.orchestrator-question.md with the options and your recommendation, and`,
    `stop. Luis will reopen this session and answer you in it.`,
    ``,
    `That file is a mailbox, not a log. Write it only to ask a question that is`,
    `live right now. Never write an answered question back to it, for the record`,
    `or for any other reason: anything sitting in it stops the build. The record`,
    `of a settled question belongs in ${rung.kind === "meta" ? "the document you are writing" : "the milestone card"}.`,
    ``,
    `Do not commit and do not push. The orchestrator verifies your work with its`,
    `own check and commits only if that check passes.`,
  ].join("\n");
};

export const workPrompt = (rung: Rung, attempt: number, lastFailure?: string): string => {
  const parts: string[] = [rung.prompt.trim(), ""];

  // A meta rung has no card. Pointing it at one that does not exist is how a
  // session spends its first turns working out that the instruction is wrong.
  if (rung.kind === "build")
    parts.push(
      `Read ${cards(rung)} for the full brief. Everything you need is in the card;`,
      `do not read docs/spec.md.`,
      "",
    );

  if (attempt > 1 && lastFailure) {
    parts.push(
      `This is attempt ${attempt}. The previous attempt was discarded, but its`,
      `Notes are still in the card. Read them first. The check that failed and its`,
      `output:`,
      "",
      lastFailure,
      "",
    );
  }

  parts.push(closeout(rung));
  return parts.join("\n");
};

// Run after a failed check when the session believed it was finished, so the
// next attempt inherits the lesson instead of the dead end.
export const notesPrompt = (rung: Rung, failure: string): string =>
  [
    `The verification for ${rung.milestones.join(", ")} failed after the last`,
    `session ended. The check and its output:`,
    "",
    failure,
    "",
    `Append to the "Notes" section of ${cards(rung)} what was attempted and why it`,
    `failed, with the mechanism if you can determine it. Do not attempt a fix, do`,
    `not commit, and do not change any code. Then stop.`,
  ].join("\n");
