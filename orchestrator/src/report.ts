// The three places the orchestrator reports outward: a status file you can
// glance at, the Cost table inside each card, and a push to the phone.

import { STATUS_PATH, cardPath, rungState, type Ladder, type State } from "./schema";

const money = (n: number) => `$${n.toFixed(2)}`;
const mins = (ms: number) => `${Math.round(ms / 60000)}m`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const MARK: Record<string, string> = {
  green: "done",
  awaiting: "waiting",
  paused: "asked",
  failed: "stuck",
  pending: "",
};

// --- BUILD-STATUS.md -------------------------------------------------------

export const writeStatus = async (dir: string, ladder: Ladder, state: State): Promise<void> => {
  const rows = ladder.rungs.map((rung) => {
    const s = rungState(state, rung.id);
    const cost = s.costUsd > 0 ? money(s.costUsd) : "";
    const wall = s.wallMs > 0 ? mins(s.wallMs) : "";
    const attempts = s.attempts > 0 ? String(s.attempts) : "";
    return `| ${MARK[s.status]} | ${rung.id} ${rung.name} | ${rung.milestones.join(", ")} | ${attempts} | ${cost} | ${wall} |`;
  });

  const done = ladder.rungs.filter((r) => rungState(state, r.id).status === "green").length;
  const headline = state.done
    ? "Complete."
    : state.park
      ? `Parked at ${state.park.rungId}. Waiting on you.`
      : "Running.";

  const lines = [
    `# ${ladder.project} build status`,
    "",
    `${headline} ${done} of ${ladder.rungs.length} rungs green, ${money(state.totalCostUsd)} spent.`,
    `Updated ${new Date().toISOString()}.`,
    "",
    "| | Rung | Milestones | Attempts | Cost | Wall |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ];

  if (state.park) {
    const cmd = "orchestrator";
    lines.push(
      "## Waiting on you",
      "",
      `**${state.park.rungId}.** ${state.park.message}`,
      "",
    );
    if (state.park.detail) lines.push("```", state.park.detail.trim(), "```", "");
    if (state.park.kind === "human")
      lines.push(
        "Answer with one of:",
        "",
        "```",
        `${cmd} answer ${state.park.rungId} pass`,
        `${cmd} answer ${state.park.rungId} fail "what is wrong"`,
        "```",
        "",
      );
    if (state.park.kind === "human" && state.park.detail)
      lines.push("Or reopen the session above and talk to it directly.", "");
    else if (state.park.kind === "question")
      lines.push(
        "Reopen the session above, answer it there, and let it finish. Then:",
        "",
        "```",
        `${cmd} run`,
        "```",
        "",
        "The next run re-checks before spending a new session, so work you",
        "finished by hand in that session counts.",
        "",
      );
    else
      lines.push("Fix the cause, then resume with:", "", "```", `${cmd} run`, "```", "");
  }

  lines.push(
    "---",
    "",
    "Written by the orchestrator. Do not hand-edit; it is rewritten every rung.",
  );

  await Bun.write(`${dir}/${STATUS_PATH}`, lines.join("\n") + "\n");
};

// --- the card's Cost table -------------------------------------------------

export type Cost = {
  wallMs: number;
  checkRuns: number;
  checkMs: number;
  restarts: number;
};

// The card carries an empty four-column Cost table written at author time.
// These are the only numbers in the whole workflow that cannot be recovered
// after the fact, which is why the orchestrator writes them rather than asking
// a session to remember them.
export const writeCostRow = async (dir: string, milestone: string, cost: Cost): Promise<boolean> => {
  const path = `${dir}/${cardPath(milestone)}`;
  const file = Bun.file(path);
  if (!(await file.exists())) return false;

  const text = await file.text();
  const row = `| ${mins(cost.wallMs)} | ${cost.checkRuns} | ${secs(cost.checkMs)} | ${cost.restarts} |`;

  // Find the separator line inside the Cost section and replace the row under it.
  const lines = text.split("\n");
  const heading = lines.findIndex((l) => /^##\s+Cost\b/i.test(l));
  if (heading === -1) return false;
  const sep = lines.findIndex((l, i) => i > heading && /^\|(\s*:?-{2,}:?\s*\|)+$/.test(l.trim()));
  if (sep === -1 || sep > heading + 12) return false;
  if (!lines[sep + 1]?.trim().startsWith("|")) return false;

  lines[sep + 1] = row;
  await Bun.write(path, lines.join("\n"));
  return true;
};

// --- phone -----------------------------------------------------------------

// The topic lives in hooks/notify-phone.sh, which is untracked. Read it from
// there rather than copying it into a tracked file.
const topic = async (): Promise<string | null> => {
  // Set ORCHESTRATOR_NO_NOTIFY=1 for dry runs and tests.
  if (process.env.ORCHESTRATOR_NO_NOTIFY) return null;
  if (process.env.CC_NTFY_TOPIC) return process.env.CC_NTFY_TOPIC;
  const hook = Bun.file(`${process.env.HOME}/.claude/hooks/notify-phone.sh`);
  if (!(await hook.exists())) return null;
  const match = (await hook.text()).match(/TOPIC="\$\{CC_NTFY_TOPIC:-([^}"]+)\}"/);
  return match?.[1] ?? null;
};

export const notify = async (title: string, body: string, urgent = false): Promise<void> => {
  const t = await topic();
  if (!t) return;
  try {
    await fetch(`https://ntfy.sh/${t}`, {
      method: "POST",
      headers: {
        Title: title,
        Tags: urgent ? "warning" : "white_check_mark",
        Priority: urgent ? "high" : "default",
      },
      body: body.slice(0, 400),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // A missed notification must never stop a build.
  }
};
