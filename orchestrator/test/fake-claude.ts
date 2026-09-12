#!/usr/bin/env bun
// A stand-in for `claude` that costs nothing.
//
// The orchestrator's contract with a session is narrow. It starts a process,
// reads one JSON envelope off stdout, and then judges the tree with its own
// check in a clean shell. Nothing in that contract needs a model, which is
// what makes the whole loop testable for free: a process that writes the files
// a real session would have written is indistinguishable from one that thought
// about it first.
//
// Behaviour comes from FAKE_STEPS, a JSON array matched in order against the
// prompt. First match wins; no match means a session that ran and changed
// nothing, which is exactly how a real one fails a check.

import { z } from "zod";
import { randomUUID } from "node:crypto";

const Step = z.object({
  // Regex tested against the prompt. Capture groups are substituted into every
  // string below, keys included, as $1..$9.
  match: z.string(),
  // Apply at most this many times, then fall through to the next match. This
  // is how a scenario fails twice and lands on the third attempt.
  times: z.number().int().positive().optional(),
  // What the session writes. Path relative to the project, then content.
  write: z.record(z.string(), z.string()).default({}),
  // A rung to append to docs/ladder.json, which is what an extension session
  // does and the only structural edit a session ever makes.
  appendRung: z.record(z.string(), z.unknown()).optional(),
  // Raise a question in the mailbox instead of finishing.
  question: z.string().optional(),
  // Fail the session itself rather than its check. Put "usage limit" in here
  // to exercise the path that gives the attempt back.
  error: z.string().optional(),
  cost: z.number().default(0.01),
});

const Steps = z.array(Step);

// argv is `claude -p <prompt> ...` headless and `claude <prompt>` attached.
const promptOf = (argv: string[]): string => {
  const at = argv.indexOf("-p");
  return at === -1 ? (argv.at(-1) ?? "") : (argv[at + 1] ?? "");
};

const subst = (value: unknown, m: RegExpMatchArray): unknown => {
  if (typeof value === "string") return value.replace(/\$(\d)/g, (_, d: string) => m[Number(d)] ?? "");
  if (Array.isArray(value)) return value.map((v) => subst(v, m));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [subst(k, m) as string, subst(v, m)]),
    );
  return value;
};

// Each invocation is a fresh process, so `times` has to count on disk.
const counts = async (path: string): Promise<number[]> => {
  const file = Bun.file(path);
  return (await file.exists()) ? ((await file.json()) as number[]) : [];
};

const envelope = (cost: number, error?: string): string =>
  JSON.stringify({
    type: "result",
    subtype: error ? "error_during_execution" : "success",
    is_error: Boolean(error),
    total_cost_usd: cost,
    num_turns: 2,
    session_id: `fake-${randomUUID()}`,
    result: error ?? "ok",
  });

const main = async (): Promise<number> => {
  const stepsPath = process.env.FAKE_STEPS;
  if (!stepsPath) throw new Error("FAKE_STEPS is not set");
  const steps = Steps.parse(await Bun.file(stepsPath).json());
  const countPath = `${stepsPath}.count`;
  const seen = await counts(countPath);
  const prompt = promptOf(process.argv.slice(2));

  const i = steps.findIndex((s, at) => {
    if (s.times !== undefined && (seen[at] ?? 0) >= s.times) return false;
    return new RegExp(s.match, "m").test(prompt);
  });

  // A session that matched nothing ran and changed nothing. That is a real
  // outcome, not a harness error, so it reports success and lets the check say
  // otherwise.
  if (i === -1) {
    console.log(envelope(0.01));
    return 0;
  }

  const step = steps[i]!;
  seen[i] = (seen[i] ?? 0) + 1;
  await Bun.write(countPath, JSON.stringify(seen));

  const m = prompt.match(new RegExp(step.match, "m")) ?? ([] as unknown as RegExpMatchArray);
  for (const [path, body] of Object.entries(subst(step.write, m) as Record<string, string>))
    await Bun.write(path, body);

  if (step.appendRung) {
    const ladder = (await Bun.file("docs/ladder.json").json()) as { rungs: unknown[] };
    ladder.rungs.push(subst(step.appendRung, m));
    await Bun.write("docs/ladder.json", JSON.stringify(ladder, null, 2) + "\n");
  }

  if (step.question) await Bun.write("docs/.orchestrator-question.md", step.question);

  console.log(envelope(step.cost, step.error));
  return 0;
};

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(`fake-claude: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
