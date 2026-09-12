// The plan is the horizon. The ladder is only as far as the cards go.
//
// Cards past the taste boundary are deliberately not written up front: each
// milestone teaches the next one what its card should say, and a card written
// six milestones early is a guess. So docs/ladder.json covers a prefix of
// docs/plan.md and grows as it goes, which makes "every rung is green" and
// "the project is built" two different sentences. Everything in this file
// exists to stop the orchestrator confusing them.

import type { Ladder } from "./schema";

export const PLAN_PATH = "docs/plan.md";

// `### M7 — the game, wired`. Milestone blocks sit under `## Milestones` and
// again under `## The taste boundary`, so this reads the whole file rather
// than one section, and takes the id from the heading rather than from prose,
// which mentions milestones constantly and means nothing by it.
const HEADING = /^#{2,4}\s+(M\d+)\b/;

// Every milestone docs/plan.md names, in numeric order. A plan that names its
// milestones some other way yields nothing here, and the orchestrator then
// behaves exactly as it did before: the ladder is the whole of the job.
export const planMilestones = async (dir: string): Promise<string[]> => {
  const file = Bun.file(`${dir}/${PLAN_PATH}`);
  if (!(await file.exists())) return [];
  const found = new Set<string>();
  for (const line of (await file.text()).split("\n")) {
    const id = line.match(HEADING)?.[1];
    if (id) found.add(id);
  }
  return [...found].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
};

export const covered = (ladder: Ladder): Set<string> =>
  new Set(ladder.rungs.flatMap((r) => r.milestones));

// What the plan names and the ladder does not reach yet.
export const uncovered = (plan: string[], ladder: Ladder): string[] => {
  const have = covered(ladder);
  return plan.filter((m) => !have.has(m));
};

// The one to put on the ladder next, and the one before it, whose Notes are
// the best evidence the next card has and the reason it was not written
// earlier.
export const nextMilestone = (
  plan: string[],
  ladder: Ladder,
): { next: string; previous?: string } | null => {
  const next = uncovered(plan, ladder)[0];
  if (!next) return null;
  return { next, previous: plan[plan.indexOf(next) - 1] };
};
