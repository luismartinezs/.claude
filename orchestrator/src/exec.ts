// Every subprocess the orchestrator starts. Nothing here makes a judgement:
// it runs things and reports what happened.

import type { Ladder } from "./schema";

export type Ran = {
  code: number;
  out: string;
  err: string;
  ms: number;
  timedOut: boolean;
};

// The primitive. argv form, so nothing needs shell quoting.
export const run = async (argv: string[], cwd: string, timeoutSec = 1800): Promise<Ran> => {
  const started = Date.now();
  const proc = Bun.spawn(argv, { cwd, stdout: "pipe", stderr: "pipe", env: process.env });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill(9);
  }, timeoutSec * 1000);
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  clearTimeout(timer);
  return { code, out, err, ms: Date.now() - started, timedOut };
};

// Check commands come from the ladder as one shell string, because that is how
// they read in the plan: `bun run verify:x && bun test`.
export const sh = (cmd: string, cwd: string, timeoutSec = 1800): Promise<Ran> =>
  run(["bash", "-c", cmd], cwd, timeoutSec);

export const tail = (text: string, lines = 40): string =>
  text.trimEnd().split("\n").slice(-lines).join("\n");

// --- git -------------------------------------------------------------------

const git = (args: string[], cwd: string) => run(["git", ...args], cwd, 300);

// The state file and the status page are the orchestrator's own runtime output.
// They go in the repo's local exclude rather than the project's .gitignore, so
// they never appear in a commit and never block a rung for a dirty tree.
export const ensureExcluded = async (cwd: string, patterns: string[]): Promise<void> => {
  const path = `${cwd}/.git/info/exclude`;
  const file = Bun.file(path);
  const current = (await file.exists()) ? await file.text() : "";
  const lines = current.split("\n").map((l) => l.trim());
  const missing = patterns.filter((p) => !lines.includes(p));
  if (missing.length === 0) return;
  const prefix = current.endsWith("\n") || current === "" ? "" : "\n";
  await Bun.write(path, `${current}${prefix}${missing.join("\n")}\n`);
};

export const isClean = async (cwd: string): Promise<boolean> =>
  (await git(["status", "--porcelain"], cwd)).out.trim() === "";

export const currentBranch = async (cwd: string): Promise<string> =>
  (await git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)).out.trim();

export const ensureBranch = async (cwd: string, branch: string): Promise<void> => {
  if ((await currentBranch(cwd)) === branch) return;
  const exists = await git(["rev-parse", "--verify", branch], cwd);
  const args = exists.code === 0 ? ["checkout", branch] : ["checkout", "-b", branch];
  const r = await git(args, cwd);
  if (r.code !== 0) throw new Error(`could not switch to ${branch}: ${r.err.trim()}`);
};

export const commit = async (
  cwd: string,
  paths: string[],
  subject: string,
  body: string,
): Promise<boolean> => {
  const add = await git(["add", "--", ...paths], cwd);
  if (add.code !== 0) throw new Error(`git add failed: ${add.err.trim()}`);
  const staged = await git(["diff", "--cached", "--quiet"], cwd);
  if (staged.code === 0) return false; // nothing to commit
  const message = body ? `${subject}\n\n${body}` : subject;
  const r = await git(["commit", "-m", message], cwd);
  if (r.code !== 0) throw new Error(`git commit failed: ${r.err.trim() || r.out.trim()}`);
  return true;
};

// Discard a failed attempt's code. Ignored files (node_modules, build output)
// are left alone, which is why this is `clean -fd` and not `clean -fdx`.
export const resetWorktree = async (cwd: string): Promise<void> => {
  await git(["checkout", "--", "."], cwd);
  await git(["clean", "-fd"], cwd);
};

export const tagExists = async (cwd: string, name: string): Promise<boolean> =>
  (await git(["rev-parse", "--verify", `refs/tags/${name}`], cwd)).code === 0;

export const tagHere = async (cwd: string, name: string): Promise<void> => {
  await git(["tag", "-f", name], cwd);
};

export const push = async (cwd: string, branch: string): Promise<Ran> =>
  git(["push", "--follow-tags", "-u", "origin", branch], cwd);

// --- claude ----------------------------------------------------------------

export type ClaudeRun = {
  ok: boolean;
  costUsd: number;
  turns: number;
  sessionId: string;
  result: string;
  ms: number;
  error?: string;
};

// `claude -p --output-format json` prints one JSON object. Take the last line
// that parses, so a stray warning on stdout cannot break the run.
const lastJson = (text: string): Record<string, unknown> | null => {
  const lines = text.trim().split("\n").reverse();
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // not JSON, keep walking back
    }
  }
  return null;
};

const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

// An attached session. Luis talks to it directly, the orchestrator waits, and
// there is no JSON to read afterwards: what it did is on disk, and the rung's
// check is what decides whether it did it.
export const runClaudeAttached = async (
  prompt: string,
  cwd: string,
  ladder: Ladder,
): Promise<ClaudeRun> => {
  const argv = ["claude", ...(ladder.model ? ["--model", ladder.model] : []), prompt];
  const started = Date.now();
  const proc = Bun.spawn(argv, { cwd, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  return {
    ok: code === 0,
    costUsd: 0,
    turns: 0,
    sessionId: "",
    result: "",
    ms: Date.now() - started,
    error: code === 0 ? undefined : `the session exited ${code}`,
  };
};

export const runClaude = async (
  prompt: string,
  cwd: string,
  ladder: Ladder,
  timeoutSec = 4 * 3600,
): Promise<ClaudeRun> => {
  const argv = [
    "claude",
    "-p",
    prompt,
    "--output-format",
    "json",
    "--permission-mode",
    ladder.permissionMode,
  ];
  if (ladder.model) argv.push("--model", ladder.model);
  argv.push(...ladder.extraArgs);

  const r = await run(argv, cwd, timeoutSec);
  const json = lastJson(r.out);
  if (!json)
    return {
      ok: false,
      costUsd: 0,
      turns: 0,
      sessionId: "",
      result: "",
      ms: r.ms,
      error: r.timedOut ? `timed out after ${timeoutSec}s` : tail(r.err || r.out, 20) || `exit ${r.code}`,
    };

  const isError = json.is_error === true || json.subtype !== "success";
  return {
    ok: r.code === 0 && !isError,
    costUsd: num(json.total_cost_usd),
    turns: num(json.num_turns),
    sessionId: str(json.session_id),
    result: str(json.result),
    ms: r.ms,
    error: isError ? str(json.result) || str(json.subtype) : undefined,
  };
};
