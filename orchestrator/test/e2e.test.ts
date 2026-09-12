// The orchestrator, end to end, for nothing.
//
// Every scenario drives the real `run.ts` in a real git repo. The only thing
// that is not real is the session, and the session is the only part of the
// system that has no logic of its own: the orchestrator never asks it whether
// it is done, it asks a check. So mocking it costs nothing and hides nothing.

import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import { cleanup, cli, env, exists, project, serverAt, state, subjects, tags } from "./harness";

afterAll(cleanup);

// The claim this whole suite rests on, asserted rather than assumed. If the
// shim ever stopped shadowing the real binary, every scenario below would
// quietly start spending money instead of failing.
test("no scenario in this file can reach a real session", async () => {
  const p = await project({}, []);
  expect(Bun.which("claude", { PATH: env(p).PATH })).toBe(join(p.mock, "claude"));
});

const PLAN = (...ms: string[]) =>
  ["# Toy — Build Plan", "", "## Milestones", "", ...ms.map((m) => `### ${m} — a thing\n`)].join(
    "\n",
  );

const ladder = (rungs: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify(
    { project: "repo", branch: "build/repo", budgetUsd: { total: 100 }, rungs, ...extra },
    null,
    2,
  );

const buildRung = (m: string) => ({
  id: `S${m}`,
  name: `build ${m}`,
  milestones: [m],
  prompt: `Implement ${m} per docs/milestones/${m}.md.`,
  oracle: { kind: "command", run: `test -f built-${m}` },
});

// The two steps almost every scenario wants: a session that builds a milestone,
// and a session that puts the next one on the ladder.
const BUILDS = { match: "^Implement (M\\d+)", write: { "built-$1": "ok\n" } };
const GROWS = {
  match: "^(M\\d+) is the next milestone",
  write: { "docs/milestones/$1.md": "# $1\n" },
  appendRung: {
    id: "S$1",
    name: "build $1",
    milestones: ["$1"],
    prompt: "Implement $1 per docs/milestones/$1.md.",
    oracle: { kind: "command", run: "test -f built-$1" },
  },
};

test(
  "from an empty repo to a built plan, planning and growth included",
  async () => {
    const p = await project({}, [
      { match: "refine-spec", write: { "docs/spec.md": "# spec\n" } },
      { match: "plan-milestones", write: { "docs/plan.md": PLAN("M0", "M1", "M2") } },
      { match: "route-decisions", write: { "docs/decisions.md": "# decisions\n" } },
      { match: "^author mode", write: { "docs/milestones/M0.md": "# M0\n" } },
      {
        match: "write-runbook",
        write: { "docs/runbook.md": "# runbook\n", "docs/ladder.json": ladder([buildRung("M0")]) },
      },
      GROWS,
      BUILDS,
    ]);

    // P0 is a conversation, and there is no terminal here, so it hands the
    // command back instead of pretending to have one.
    const one = await cli(p, ["run"]);
    expect(one.code).toBe(10);
    expect((await state(p)).park).toMatchObject({ rungId: "P0", kind: "conversation" });

    expect((await cli(p, ["converse", "P0"])).code).toBe(0);

    const two = await cli(p, ["run"]);
    expect(two.code).toBe(10);
    expect((await state(p)).park).toMatchObject({ rungId: "P2", kind: "conversation" });

    expect((await cli(p, ["converse", "P2"])).code).toBe(0);

    const three = await cli(p, ["run"]);
    expect(three.code).toBe(0);

    const s = await state(p);
    expect(s.done).toBe(true);
    expect(s.park).toBeNull();
    expect(s.plan).toEqual(["M0", "M1", "M2"]);

    // Planning, the ladder's own rung, then a growth rung and a build rung for
    // each milestone the plan named and the ladder did not. Newest first, and
    // every one of them is a commit that passed an oracle.
    expect(await subjects(p)).toEqual([
      "SM2 build M2: M2",
      "XM2 put M2 on the ladder: M2",
      "SM1 build M1: M1",
      "XM1 put M1 on the ladder: M1",
      "SM0 build M0: M0",
      "P4 runbook: runbook",
      "P3 cards: cards",
      "P2 decisions: decisions",
      "P1 plan: plan",
      "P0 spec: spec",
      "init",
    ]);
    expect((await tags(p)).sort()).toEqual(
      ["P0", "P1", "P2", "P3", "P4", "SM0", "SM1", "SM2", "XM1", "XM2"].sort(),
    );
    expect(await exists(p, "built-M2")).toBe(true);
  },
  120_000,
);

test(
  "a human oracle waits, takes a rejection, and lands on a pass",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/ladder.json": ladder([
          {
            ...buildRung("M0"),
            oracle: { kind: "human", ask: "Is it good?", artifact: "built-M0" },
          },
        ]),
      },
      [BUILDS],
    );

    const one = await cli(p, ["run"]);
    expect(one.code).toBe(10);
    expect((await state(p)).park).toMatchObject({ rungId: "SM0", kind: "human" });
    expect((await state(p)).rungs.SM0?.status).toBe("awaiting");
    expect(await tags(p)).toEqual([]);

    await cli(p, ["answer", "SM0", "fail", "the right edge drifts"]);
    const two = await cli(p, ["run"]);
    expect(two.code).toBe(10);
    expect((await state(p)).rungs.SM0?.attempts).toBe(2);
    expect(await tags(p)).toEqual([]);

    await cli(p, ["answer", "SM0", "pass"]);
    const three = await cli(p, ["run"]);
    expect(three.code).toBe(0);
    expect((await state(p)).done).toBe(true);
    expect(await tags(p)).toEqual(["SM0"]);
  },
  120_000,
);

test(
  "a question stops the build, and the answer does not cost a new session",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/ladder.json": ladder([buildRung("M0")]),
      },
      [{ match: "^Implement M0", question: "Which colour is the floor?\n" }],
    );

    const one = await cli(p, ["run"]);
    expect(one.code).toBe(10);
    expect((await state(p)).park).toMatchObject({
      rungId: "SM0",
      kind: "question",
      message: "Which colour is the floor?",
    });
    expect(await tags(p)).toEqual([]);
    // The mailbox is emptied when it is read, or it would stop every run after.
    expect(await exists(p, "docs/.orchestrator-question.md")).toBe(false);

    // Answered in the resumed session, which here means the work simply lands.
    await Bun.write(`${p.dir}/built-M0`, "ok\n");
    const two = await cli(p, ["run"]);
    expect(two.code).toBe(0);
    expect(await tags(p)).toEqual(["SM0"]);
    expect((await state(p)).rungs.SM0?.attempts).toBe(1);
  },
  120_000,
);

test(
  "three failed attempts derail, and nothing that failed a check is committed",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/ladder.json": ladder([buildRung("M0")]),
      },
      [],
    );

    const one = await cli(p, ["run"]);
    expect(one.code).toBe(10);
    expect((await state(p)).park).toMatchObject({ rungId: "SM0", kind: "derail" });
    expect((await state(p)).rungs.SM0?.attempts).toBe(3);
    expect(await tags(p)).toEqual([]);
    expect(await subjects(p)).toEqual(["init"]);
  },
  120_000,
);

test(
  "a check that is green before the work parks instead of marching past it",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/ladder.json": ladder([
          { ...buildRung("M0"), oracle: { kind: "command", run: "true" } },
        ]),
      },
      [BUILDS],
    );

    const one = await cli(p, ["run"]);
    expect(one.code).toBe(10);
    expect((await state(p)).park).toMatchObject({ rungId: "SM0", kind: "tautology" });
    expect((await state(p)).rungs.SM0?.attempts).toBe(0);
    expect(await tags(p)).toEqual([]);
  },
  120_000,
);

test(
  "a usage limit gives the attempt back instead of spending it",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/ladder.json": ladder([buildRung("M0")]),
      },
      [{ match: "^Implement M0", error: "Claude usage limit reached. resets 3pm" }],
    );

    const one = await cli(p, ["run"]);
    expect(one.code).toBe(10);
    const s = await state(p);
    expect(s.park?.kind).toBe("budget");
    expect(s.park?.message).toStartWith("Out of Claude usage");
    expect(s.rungs.SM0?.attempts).toBe(0);
  },
  120_000,
);

test(
  "the budget stops the next rung rather than the one already running",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0", "M1"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/milestones/M1.md": "# M1\n",
        "docs/ladder.json": ladder([buildRung("M0"), buildRung("M1")], {
          budgetUsd: { total: 0.005 },
        }),
      },
      [BUILDS],
    );

    const one = await cli(p, ["run"]);
    expect(one.code).toBe(10);
    const s = await state(p);
    expect(s.park).toMatchObject({ rungId: "SM1", kind: "budget" });
    expect(s.park?.message).toStartWith("Build budget reached");
    expect(await tags(p)).toEqual(["SM0"]);
  },
  120_000,
);

test(
  "it refuses to build on main",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/ladder.json": ladder([buildRung("M0")], { branch: "main" }),
      },
      [BUILDS],
    );

    const one = await cli(p, ["run"]);
    expect(one.code).toBe(1);
    expect(one.err).toContain("Use a build branch");
    expect(await tags(p)).toEqual([]);
  },
  120_000,
);

test(
  "an extension that writes the card but no rung derails rather than looping",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0", "M1"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/ladder.json": ladder([buildRung("M0")]),
      },
      [
        BUILDS,
        // The card lands, the ladder never grows. The rung's check is what
        // notices, which is the whole reason it asserts both halves.
        {
          match: "^(M\\d+) is the next milestone",
          write: { "docs/milestones/$1.md": "# $1\n" },
        },
      ],
    );

    const one = await cli(p, ["run"]);
    expect(one.code).toBe(10);
    const s = await state(p);
    expect(s.park).toMatchObject({ rungId: "XM1", kind: "derail" });
    expect(s.done).toBe(false);
    expect(await tags(p)).toEqual(["SM0"]);
    // The status page is about the build ladder even while another one runs.
    expect(await Bun.file(`${p.dir}/docs/BUILD-STATUS.md`).text()).toContain("SM0 build M0");
  },
  120_000,
);

test(
  "the app serves what the orchestrator wrote",
  async () => {
    const p = await project(
      {
        "docs/plan.md": PLAN("M0"),
        "docs/milestones/M0.md": "# M0\n",
        "docs/ladder.json": ladder([buildRung("M0")]),
      },
      [BUILDS],
    );
    expect((await cli(p, ["run"])).code).toBe(0);

    const port = 20000 + Math.floor(Math.random() * 20000);
    const roots = p.dir.replace(/\/repo$/, "");
    const server = serverAt(port, roots);
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 80; i++) {
        try {
          await fetch(`${base}/api/projects`);
          break;
        } catch {
          await Bun.sleep(50);
        }
      }

      const projects = (await (await fetch(`${base}/api/projects`)).json()) as {
        name: string;
        phase: string;
      }[];
      expect(projects.map((x) => x.name)).toContain("repo");

      const snap = (await (
        await fetch(`${base}/api/snapshot?dir=${encodeURIComponent(p.dir)}`)
      ).json()) as { state: { done: boolean }; ladder: { rungs: { id: string }[] } };
      expect(snap.state.done).toBe(true);
      expect(snap.ladder.rungs.map((r) => r.id)).toEqual(["SM0"]);
    } finally {
      server.kill();
      await server.exited;
    }
  },
  120_000,
);
