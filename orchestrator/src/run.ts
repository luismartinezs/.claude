#!/usr/bin/env bun
// The loop. It starts one fresh Claude Code session per rung, checks the
// result itself, and commits only what its own check passed.
//
// It has no opinions on purpose: an agent can be talked out of a failing
// check, an exit code cannot.
//
// Each invocation moves the ladder as far as it can and then exits:
//   0   ladder complete
//   10  parked, waiting on the operator
//   1   the orchestrator itself could not proceed

import {
  LADDER_PATH,
  QUESTION_PATH,
  RungState,
  STATE_PATH,
  STATUS_PATH,
  loadLadder,
  loadState,
  saveState,
  rungState,
  type Ladder,
  type Park,
  type Rung,
  type State,
} from "./schema";
import {
  commit,
  currentBranch,
  ensureBranch,
  ensureExcluded,
  isClean,
  push,
  resetWorktree,
  runClaude,
  runClaudeAttached,
  sh,
  tagExists,
  tagHere,
  tail,
} from "./exec";
import { notesPrompt, workPrompt } from "./prompt";
import { notify, writeCostRow, writeStatus } from "./report";
import { planningLadder } from "./planning";
import { basename } from "node:path";

const EXIT = { done: 0, error: 1, parked: 10 } as const;

const now = () => new Date().toISOString();
const log = (...parts: unknown[]) => console.log(...parts);
const money = (n: number) => `$${n.toFixed(2)}`;

const setRung = (state: State, id: string, s: RungState) => {
  state.rungs[id] = s;
};

// Every park hands back the way into the session that caused it. Resuming keeps
// that session's full context, so the conversation starts where the work is.
const door = (dir: string, s: RungState): string | undefined => {
  const id = s.sessions.at(-1);
  return id ? `cd ${dir} && claude --resume ${id}` : undefined;
};

const parkAt = async (dir: string, ladder: Ladder, state: State, park: Park): Promise<number> => {
  state.park = park;
  await saveState(dir, state);
  await writeStatus(dir, ladder, state);
  await notify(`${ladder.project} ${park.rungId}`, park.message, park.kind !== "human");
  log(`\nparked at ${park.rungId}: ${park.message}`);
  return EXIT.parked;
};

// Shared by the command path and the human-verdict path.
const landRung = async (
  dir: string,
  ladder: Ladder,
  state: State,
  rung: Rung,
  s: RungState,
  sessionId: string,
): Promise<void> => {
  for (const m of rung.milestones)
    await writeCostRow(dir, m, {
      wallMs: s.wallMs,
      checkRuns: s.checkRuns,
      checkMs: s.checkMs,
      restarts: Math.max(0, s.attempts - 1),
    });

  const verdict =
    rung.oracle.kind === "command"
      ? `\`${rung.oracle.run}\` exited 0.`
      : "Judged by the operator.";
  const body = [
    verdict,
    "",
    "Co-Authored-By: Claude Code <noreply@anthropic.com>",
    sessionId ? `Claude-Session: ${sessionId}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await commit(dir, ["."], `${rung.id} ${rung.name}: ${rung.milestones.join(", ")}`, body);
  await tagHere(dir, rung.id);
  if (ladder.push) {
    const p = await push(dir, ladder.branch);
    if (p.code !== 0) log(`  push failed, continuing: ${tail(p.err, 3)}`);
  }

  s.status = "green";
  s.finishedAt = now();
  s.tag = rung.id;
  setRung(state, rung.id, s);
  await saveState(dir, state);
  await writeStatus(dir, ladder, state);
  log(`  green. ${money(s.costUsd)}, ${Math.round(s.wallMs / 60000)}m, tagged ${rung.id}`);
};

const runPhase = async (dir: string, ladder: Ladder, state: State): Promise<number> => {
  state.park = null;

  await ensureExcluded(dir, [
    STATE_PATH,
    STATUS_PATH,
    QUESTION_PATH,
    "docs/.orchestrator.log",
    "docs/.orchestrator.pid",
  ]);

  if (["main", "master"].includes(ladder.branch))
    throw new Error(`${LADDER_PATH} points the build at ${ladder.branch}. Use a build branch.`);
  const inFlight = Object.values(state.rungs).some(
    (r) => r.status === "awaiting" || r.status === "paused",
  );
  await ensureBranch(dir, ladder.branch);

  // Work done outside the run, by Luis or by a session sent to repair a check,
  // gets committed rather than refused. Refusing strands the build, and worse,
  // a later failed attempt would reset the tree and destroy the very fix that
  // unblocked it.
  if (!inFlight && !(await isClean(dir))) {
    const did = await commit(dir, ["."], "changes made outside the run", "");
    if (did) log("picked up work done outside the run and committed it\n");
  }
  log(`${ladder.project} on ${await currentBranch(dir)}, ${ladder.rungs.length} rungs\n`);

  for (const rung of ladder.rungs) {
    const s = rungState(state, rung.id);
    if (s.status === "green") continue;

    if (ladder.budgetUsd.total && state.totalCostUsd >= ladder.budgetUsd.total)
      return parkAt(dir, ladder, state, {
        kind: "budget",
        rungId: rung.id,
        message: `Build budget reached: ${money(state.totalCostUsd)} of ${money(ladder.budgetUsd.total)}. Raise budgetUsd.total in ${LADDER_PATH} to continue.`,
        at: now(),
      });

    log(`${rung.id} ${rung.name} (${rung.milestones.join(", ")})`);

    // A rung that stopped for a question may have been finished by hand in the
    // resumed session. Re-check before paying for another one.
    if (s.status === "paused") {
      if (rung.oracle.kind === "command") {
        const re = await sh(rung.oracle.run, dir, rung.oracle.timeoutSec);
        s.checkRuns += 1;
        s.checkMs = re.ms;
        setRung(state, rung.id, s);
        if (re.code === 0) {
          log("  the question was answered and the check now passes");
          await landRung(dir, ladder, state, rung, s, s.sessions.at(-1) ?? "");
          continue;
        }
        log(`  still red after the question (exit ${re.code}), continuing`);
        s.status = "pending";
      } else {
        s.status = "awaiting";
      }
      setRung(state, rung.id, s);
    }

    // A human-oracle rung that already ran is waiting on a verdict.
    if (s.status === "awaiting") {
      const v = state.verdicts[rung.id];
      if (!v)
        return parkAt(dir, ladder, state, {
          kind: "human",
          rungId: rung.id,
          message: rung.oracle.kind === "human" ? rung.oracle.ask : "Waiting on your verdict.",
          detail: door(dir, s),
          at: now(),
        });
      delete state.verdicts[rung.id];
      if (v.pass) {
        log(`  you passed it${v.note ? `: ${v.note}` : ""}`);
        await landRung(dir, ladder, state, rung, s, "");
        continue;
      }
      log(`  you failed it: ${v.note}`);
      s.lastFailure = `The operator rejected this rung: ${v.note}`;
      s.status = "pending";
      setRung(state, rung.id, s);
      await resetWorktree(dir);
    }

    // A check that is green before any work has happened is not measuring the
    // milestone, and the ladder would march straight past it.
    if (rung.oracle.kind === "command" && rung.expectRedFirst && s.attempts === 0) {
      const pre = await sh(rung.oracle.run, dir, rung.oracle.timeoutSec);
      s.checkRuns += 1;
      s.checkMs = pre.ms;
      setRung(state, rung.id, s);
      // The state file can go missing while the work stays. The rung's tag is
      // proof this loop landed it before, so that is not a broken check.
      if (pre.code === 0 && (await tagExists(dir, rung.id))) {
        s.status = "green";
        s.tag = rung.id;
        setRung(state, rung.id, s);
        await saveState(dir, state);
        log(`  already landed, tag ${rung.id} is in the tree. Skipping.`);
        continue;
      }
      if (pre.code === 0)
        return parkAt(dir, ladder, state, {
          kind: "tautology",
          rungId: rung.id,
          message:
            "The check passes before the work was done, so it does not measure this milestone. Fix the check, or set expectRedFirst to false if the work is genuinely already in the tree.",
          detail: `$ ${rung.oracle.run}\n${tail(pre.out + pre.err, 15)}`,
          at: now(),
        });
      log(`  pre-check red as expected (exit ${pre.code})`);
    }

    // No terminal to hand over, so hand out the command instead. Whoever is
    // driving (the app, or Luis) runs it, and the next run re-checks.
    if (rung.mode === "interactive" && !process.stdout.isTTY) {
      s.status = "paused";
      setRung(state, rung.id, s);
      return parkAt(dir, ladder, state, {
        kind: "conversation",
        rungId: rung.id,
        message: rung.converse ?? `${rung.id} ${rung.name} is a conversation, not a task.`,
        detail: `orchestrator converse ${rung.id}`,
        at: now(),
      });
    }

    while (s.attempts < rung.maxAttempts) {
      s.attempts += 1;
      const interactive = rung.mode === "interactive";
      if (interactive)
        log(
          `  this one is a conversation. Handing you the session now.`,
          `\n  Finish it, exit, and the run carries on by itself.\n`,
        );
      else log(`  attempt ${s.attempts} of ${rung.maxAttempts}, session running`);

      const prompt = workPrompt(rung, s.attempts, s.lastFailure);
      const r = interactive
        ? await runClaudeAttached(prompt, dir, ladder)
        : await runClaude(prompt, dir, ladder);
      s.costUsd += r.costUsd;
      s.wallMs += r.ms;
      if (r.sessionId) s.sessions.push(r.sessionId);
      state.totalCostUsd += r.costUsd;
      setRung(state, rung.id, s);
      await saveState(dir, state);
      if (interactive) log(`  session closed after ${Math.round(r.ms / 60000)}m`);
      else log(`    session ended, ${r.turns} turns, ${money(r.costUsd)}, ${Math.round(r.ms / 60000)}m`);
      if (r.sessionId) log(`    reopen it with: claude --resume ${r.sessionId}`);

      // The session hit something its card could not settle and stopped rather
      // than guessing. Leave the tree alone; the answer belongs in that session.
      const raised = Bun.file(`${dir}/${QUESTION_PATH}`);
      if (await raised.exists()) {
        const asked = (await raised.text()).trim();
        await raised.delete();
        s.status = "paused";
        setRung(state, rung.id, s);
        return parkAt(dir, ladder, state, {
          kind: "question",
          rungId: rung.id,
          message: asked.split("\n")[0] ?? "The session raised a question.",
          detail: [asked, "", `Answer it in the session: ${door(dir, s) ?? "no session id"}`].join("\n"),
          at: now(),
        });
      }

      if (!r.ok) {
        s.lastFailure = `The session itself failed: ${r.error ?? "unknown"}`;
        log(`    session error: ${r.error}`);
        await resetWorktree(dir);
        continue;
      }

      if (rung.oracle.kind === "human") {
        s.status = "awaiting";
        setRung(state, rung.id, s);
        return parkAt(dir, ladder, state, {
          kind: "human",
          rungId: rung.id,
          message: rung.oracle.ask,
          detail: [rung.oracle.artifact, door(dir, s)].filter(Boolean).join("\n"),
          at: now(),
        });
      }

      const check = await sh(rung.oracle.run, dir, rung.oracle.timeoutSec);
      s.checkRuns += 1;
      s.checkMs = check.ms;
      setRung(state, rung.id, s);
      log(
        `    check \`${rung.oracle.run}\` exited ${check.code} in ${(check.ms / 1000).toFixed(1)}s`,
      );

      if (check.code === 0) {
        await landRung(dir, ladder, state, rung, s, r.sessionId);
        break;
      }

      // Red. Keep the lesson, drop the code.
      const failure = `$ ${rung.oracle.run}\n${tail(check.out + check.err, 30)}`;
      s.lastFailure = failure;
      const n = await runClaude(notesPrompt(rung, failure), dir, ladder, 900);
      s.costUsd += n.costUsd;
      state.totalCostUsd += n.costUsd;
      setRung(state, rung.id, s);
      await commit(dir, ["docs"], `${rung.id} attempt ${s.attempts}: notes from a failed check`, "");
      await resetWorktree(dir);
      await saveState(dir, state);
      log("    notes kept, code discarded");
    }

    if (rungState(state, rung.id).status !== "green") {
      s.status = "failed";
      setRung(state, rung.id, s);
      return parkAt(dir, ladder, state, {
        kind: "derail",
        rungId: rung.id,
        message:
          rung.mode === "interactive"
            ? `You left ${rung.id} before its check passed. Run the orchestrator again to pick it up where it stopped.`
            : `${rung.maxAttempts} attempts failed. The notes from each are in ${rung.milestones.join(", ")}. This one needs you.`,
        detail: [s.lastFailure, "", `Reopen the last attempt: ${door(dir, s) ?? "no session id"}`].join("\n"),
        at: now(),
      });
    }
  }

  await saveState(dir, state);
  await writeStatus(dir, ladder, state);
  return EXIT.done;
};

// The whole run, planning included. Planning is a fixed ladder the orchestrator
// carries; the build ladder is the file that planning's last rung writes. One
// command covers both, and nothing in between asks Luis to start anything.
const hasBuildLadder = (dir: string) => Bun.file(`${dir}/${LADDER_PATH}`).exists();

const currentLadder = async (dir: string): Promise<Ladder> =>
  (await hasBuildLadder(dir))
    ? loadLadder(dir)
    : planningLadder(basename(dir), `build/${basename(dir)}`);

const runAll = async (dir: string): Promise<number> => {
  const project = basename(dir);

  if (!(await hasBuildLadder(dir))) {
    log(`no build ladder yet. Planning ${project} first.\n`);
    const plan = planningLadder(project, `build/${project}`);
    const state = await loadState(dir, project);
    const code = await runPhase(dir, plan, state);
    if (code !== EXIT.done) return code;
    log(`\nplanning done. Everything from here runs without you unless it asks.\n`);
  }

  const ladder = await loadLadder(dir);
  const state = await loadState(dir, ladder.project);
  const code = await runPhase(dir, ladder, state);
  if (code !== EXIT.done) return code;

  state.done = true;
  await saveState(dir, state);
  await writeStatus(dir, ladder, state);
  await notify(
    `${ladder.project} complete`,
    `All ${ladder.rungs.length} rungs green, ${money(state.totalCostUsd)}.`,
  );
  log(`\nbuild complete. ${money(state.totalCostUsd)} total.`);
  return EXIT.done;
};

// Run one interactive rung attached to this terminal. The app calls this in a
// terminal window it opens; you can also call it yourself.
const converse = async (dir: string, id: string): Promise<number> => {
  const ladder = await currentLadder(dir);
  const state = await loadState(dir, ladder.project);
  const rung = ladder.rungs.find((r) => r.id === id);
  if (!rung) throw new Error(`no rung ${id}`);

  await ensureBranch(dir, ladder.branch);
  const s = rungState(state, id);
  s.attempts += 1;
  log(`${rung.id} ${rung.name}. ${rung.converse ?? ""}\n`);

  const r = await runClaudeAttached(workPrompt(rung, s.attempts, s.lastFailure), dir, ladder);
  s.wallMs += r.ms;
  s.costUsd += r.costUsd;
  if (r.sessionId) s.sessions.push(r.sessionId);
  s.status = "paused";
  setRung(state, id, s);
  state.park = null;
  await saveState(dir, state);
  await writeStatus(dir, ladder, state);
  log(`\n${id} closed. The run picks up from here.`);
  return EXIT.done;
};

const answer = async (dir: string, id: string, pass: boolean, note: string): Promise<number> => {
  const ladder = await currentLadder(dir);
  const state = await loadState(dir, ladder.project);
  if (!ladder.rungs.some((r) => r.id === id)) throw new Error(`no rung ${id} in ${LADDER_PATH}`);
  state.verdicts[id] = { pass, note, at: now() };
  if (state.park?.rungId === id) state.park = null;
  await saveState(dir, state);
  await writeStatus(dir, ladder, state);
  log(`${id} recorded as ${pass ? "pass" : "fail"}. Resume with: orchestrator run`);
  return EXIT.done;
};

const reset = async (dir: string, id: string): Promise<number> => {
  const ladder = await currentLadder(dir);
  const state = await loadState(dir, ladder.project);
  delete state.rungs[id];
  delete state.verdicts[id];
  if (state.park?.rungId === id) state.park = null;
  state.done = false;
  await saveState(dir, state);
  await writeStatus(dir, ladder, state);
  log(`${id} reset to pending`);
  return EXIT.done;
};

const status = async (dir: string): Promise<number> => {
  const ladder = await currentLadder(dir);
  const state = await loadState(dir, ladder.project);
  await writeStatus(dir, ladder, state);
  log(await Bun.file(`${dir}/docs/BUILD-STATUS.md`).text());
  return state.park ? EXIT.parked : EXIT.done;
};

const usage = `orchestrator, runs a whole plan-buildout from nothing to done

  orchestrator                         plan it if it needs planning, then build it
  orchestrator converse <rung>         run one conversational rung attached here
  orchestrator status                  print BUILD-STATUS.md
  orchestrator answer <rung> pass|fail [note]
  orchestrator reset <rung>            put a rung back to pending

  --dir <path>   project root, defaults to the working directory
`;

const main = async (): Promise<number> => {
  const argv = process.argv.slice(2);
  const dirFlag = argv.indexOf("--dir");
  const dir = dirFlag === -1 ? process.cwd() : (argv.splice(dirFlag, 2)[1] ?? process.cwd());
  const [cmd, ...rest] = argv;

  switch (cmd) {
    case undefined:
    case "run":
      return runAll(dir);
    case "status":
      return status(dir);
    case "answer": {
      const [id, verdict, ...note] = rest;
      if (!id || (verdict !== "pass" && verdict !== "fail")) throw new Error(usage);
      return answer(dir, id, verdict === "pass", note.join(" "));
    }
    case "converse": {
      const [id] = rest;
      if (!id) throw new Error(usage);
      return converse(dir, id);
    }
    case "reset": {
      const [id] = rest;
      if (!id) throw new Error(usage);
      return reset(dir, id);
    }
    default:
      log(usage);
      return EXIT.error;
  }
};

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(`orchestrator: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(EXIT.error);
  });
