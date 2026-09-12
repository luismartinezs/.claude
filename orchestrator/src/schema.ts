// Shapes for the two files the orchestrator reads and the one it owns.
//
// docs/ladder.json  is authored (by write-runbook) and never written here.
// docs/.orchestrator.json is owned here and never hand-edited, except through
// the `answer` and `reset` subcommands.

import { z } from "zod";

export const CommandOracle = z.object({
  kind: z.literal("command"),
  // One command. Its exit code is the verdict. It must assert, not report.
  run: z.string().min(1),
  timeoutSec: z.number().int().positive().default(1800),
});

export const HumanOracle = z.object({
  kind: z.literal("human"),
  // What the operator is being asked to judge, in one or two sentences.
  ask: z.string().min(1),
  // Optional path to open first: a contact sheet, a rendered page, a report.
  artifact: z.string().optional(),
});

export const Oracle = z.discriminatedUnion("kind", [CommandOracle, HumanOracle]);

export const Rung = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  // One or more milestone ids. Cards live at docs/milestones/<id>.md.
  milestones: z.array(z.string().min(1)).min(1),
  // The work line only. Closeout and commit policy are appended by the
  // orchestrator so they can never be dropped from a hand-written ladder.
  prompt: z.string().min(1),
  oracle: Oracle,
  // auto hands the rung to a headless session and you are not involved.
  // interactive hands you the session itself and waits, for work that is a
  // conversation rather than a task.
  mode: z.enum(["auto", "interactive"]).default("auto"),
  // build implements a milestone and answers to its card. meta produces one of
  // the documents the build runs on: the spec, the plan, the next card, the
  // next rung. A meta rung has no card to read and none to close out, and
  // telling it to close one out is a contradiction it spends a turn resolving.
  kind: z.enum(["build", "meta"]).default("build"),
  // For an interactive rung: what the conversation is for, in one line, shown
  // wherever Luis is asked to have it.
  converse: z.string().optional(),
  // Run the check before the work and require it to fail. A check that is
  // already green before anything is built is not measuring the milestone.
  expectRedFirst: z.boolean().default(true),
  maxAttempts: z.number().int().min(1).default(3),
});

export const Ladder = z.object({
  project: z.string().min(1),
  // Branch to build on. The orchestrator refuses to run on main.
  branch: z.string().default("build"),
  push: z.boolean().default(false),
  model: z.string().optional(),
  permissionMode: z.string().default("bypassPermissions"),
  extraArgs: z.array(z.string()).default([]),
  budgetUsd: z
    .object({ perRung: z.number().positive().optional(), total: z.number().positive().optional() })
    .default({}),
  rungs: z.array(Rung).min(1),
});

export const RungState = z.object({
  // pending -> (awaiting) -> green | failed
  // paused: something happened outside the loop and the tree may have moved.
  // awaiting: the work is done and a human verdict is owed.
  status: z.enum(["pending", "paused", "awaiting", "green", "failed"]).default("pending"),
  // Every session this rung has run, newest last. These are the doors: any of
  // them can be reopened with `claude --resume <id>` holding its full context.
  sessions: z.array(z.string()).default([]),
  attempts: z.number().int().default(0),
  costUsd: z.number().default(0),
  wallMs: z.number().default(0),
  checkMs: z.number().default(0),
  checkRuns: z.number().int().default(0),
  tag: z.string().optional(),
  finishedAt: z.string().optional(),
  lastFailure: z.string().optional(),
});

export const Park = z.object({
  kind: z.enum(["human", "question", "conversation", "derail", "budget", "tautology", "error"]),
  rungId: z.string(),
  message: z.string(),
  detail: z.string().optional(),
  at: z.string(),
});

export const Verdict = z.object({
  pass: z.boolean(),
  note: z.string().default(""),
  at: z.string(),
});

export const State = z.object({
  project: z.string().default(""),
  startedAt: z.string(),
  updatedAt: z.string(),
  totalCostUsd: z.number().default(0),
  rungs: z.record(z.string(), RungState).default({}),
  verdicts: z.record(z.string(), Verdict).default({}),
  park: Park.nullable().default(null),
  // Every milestone docs/plan.md names, re-read at the top of every run. The
  // ladder covers a prefix of this and grows, so it takes both to say whether
  // the project is finished. Kept here so the app can tell you the ladder is
  // not the plan without parsing the plan itself.
  plan: z.array(z.string()).default([]),
  // The plan is exhausted, not just the ladder.
  done: z.boolean().default(false),
});

export type Ladder = z.infer<typeof Ladder>;
export type Rung = z.infer<typeof Rung>;
export type Oracle = z.infer<typeof Oracle>;
export type State = z.infer<typeof State>;
export type RungState = z.infer<typeof RungState>;
export type Park = z.infer<typeof Park>;

export const LADDER_PATH = "docs/ladder.json";
export const STATE_PATH = "docs/.orchestrator.json";
export const STATUS_PATH = "docs/BUILD-STATUS.md";
// A session writes this when it hits a decision its card cannot settle.
export const QUESTION_PATH = "docs/.orchestrator-question.md";

export const cardPath = (milestone: string) => `docs/milestones/${milestone}.md`;

export const loadLadder = async (dir: string): Promise<Ladder> => {
  const file = Bun.file(`${dir}/${LADDER_PATH}`);
  if (!(await file.exists())) throw new Error(`no ${LADDER_PATH} in ${dir}`);
  return Ladder.parse(await file.json());
};

export const loadState = async (dir: string, project: string): Promise<State> => {
  const file = Bun.file(`${dir}/${STATE_PATH}`);
  const now = new Date().toISOString();
  if (!(await file.exists()))
    return State.parse({ project, startedAt: now, updatedAt: now });
  return State.parse(await file.json());
};

export const saveState = async (dir: string, state: State): Promise<void> => {
  const next = { ...state, updatedAt: new Date().toISOString() };
  await Bun.write(`${dir}/${STATE_PATH}`, JSON.stringify(next, null, 2) + "\n");
};

export const rungState = (state: State, id: string): RungState =>
  state.rungs[id] ?? RungState.parse({});
