// What every scenario needs: a throwaway git repo, a `claude` on PATH that is
// not one, and a way to read back what the orchestrator decided.
//
// The mock lives outside the repo on purpose. A failed attempt runs
// `git clean -fd`, and a harness that put itself in the working tree would be
// deleted by the very behaviour it is there to test.

import { mkdtemp, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STATE_PATH, State } from "../src/schema";

const HERE = new URL(".", import.meta.url).pathname;
const RUN = join(HERE, "../src/run.ts");
const SERVER = join(HERE, "../src/server.ts");
const FAKE = join(HERE, "fake-claude.ts");

export type Project = {
  // The repo the orchestrator runs in. Always named `repo`, because the
  // planning ladder derives the project name and branch from the basename.
  dir: string;
  mock: string;
  steps: string;
};

const made: string[] = [];

export const sh = async (argv: string[], cwd: string, env: Record<string, string> = {}) => {
  const proc = Bun.spawn(argv, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, out, err };
};

const git = (dir: string, args: string[]) =>
  sh(["git", "-c", "user.email=t@t", "-c", "user.name=t", ...args], dir);

export const project = async (
  files: Record<string, string>,
  steps: unknown[],
): Promise<Project> => {
  const ws = await mkdtemp(join(tmpdir(), "orch-e2e-"));
  made.push(ws);
  const dir = join(ws, "repo");
  const mock = join(ws, "mock");
  await mkdir(dir);
  await mkdir(mock);
  await symlink(FAKE, join(mock, "claude"));

  const steps_ = join(ws, "steps.json");
  await Bun.write(steps_, JSON.stringify(steps, null, 2));

  // An empty repo still needs one commit: an unborn HEAD has no branch to
  // report and the orchestrator asks for one before it does anything.
  await Bun.write(join(dir, ".keep"), "");
  for (const [path, body] of Object.entries(files)) await Bun.write(join(dir, path), body);
  await git(dir, ["init", "-q", "-b", "main"]);
  await git(dir, ["add", "-A"]);
  await git(dir, ["commit", "-qm", "init"]);

  return { dir, mock, steps: steps_ };
};

export const cleanup = async (): Promise<void> => {
  for (const ws of made.splice(0)) await rm(ws, { recursive: true, force: true });
};

export const env = (p: Project): Record<string, string> => ({
  PATH: `${p.mock}:${process.env.PATH ?? ""}`,
  FAKE_STEPS: p.steps,
  ORCHESTRATOR_NO_NOTIFY: "1",
});

export const cli = (p: Project, args: string[]) => sh(["bun", RUN, ...args], p.dir, env(p));

export const state = async (p: Project): Promise<State> =>
  State.parse(await Bun.file(join(p.dir, STATE_PATH)).json());

export const tags = async (p: Project): Promise<string[]> =>
  (await git(p.dir, ["tag"])).out.trim().split("\n").filter(Boolean);

export const subjects = async (p: Project): Promise<string[]> =>
  (await git(p.dir, ["log", "--format=%s"])).out.trim().split("\n").filter(Boolean);

export const exists = (p: Project, path: string): Promise<boolean> =>
  Bun.file(join(p.dir, path)).exists();

export const serverAt = (port: number, roots: string) =>
  Bun.spawn(["bun", SERVER], {
    env: { ...process.env, ORCHESTRATOR_PORT: String(port), ORCHESTRATOR_ROOTS: roots },
    stdout: "pipe",
    stderr: "pipe",
  });
