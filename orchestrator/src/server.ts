#!/usr/bin/env bun
// The app. A Bun server bound to loopback and one page, opened chromeless from
// a desktop launcher so it behaves like an application rather than a website.
//
// It holds no state of its own. The orchestrator owns the build; this starts
// it, watches it, and opens a terminal on the moments that are conversations.

import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { STATE_PATH, State } from "./schema";
import { planningLadder } from "./planning";

const HOME = process.env.HOME ?? "";
const RUN = `${HOME}/.claude/orchestrator/src/run.ts`;
const PAGE = `${HOME}/.claude/orchestrator/src/app.html`;
const ROOTS = (process.env.ORCHESTRATOR_ROOTS ?? `${HOME}/dev`).split(":");
const PORT = Number(process.env.ORCHESTRATOR_PORT ?? 7717);

type Live = { proc: Bun.Subprocess; log: string[] };
const live = new Map<string, Live>();
const logs = new Map<string, string[]>();

const lines = (dir: string) => logs.get(dir) ?? [];

// --- reading the world ------------------------------------------------------

const isRepo = async (dir: string) => Bun.file(join(dir, ".git/HEAD")).exists();

const projects = async () => {
  const found: { dir: string; name: string; phase: string }[] = [];
  for (const root of ROOTS) {
    let entries: string[] = [];
    try {
      entries = await readdir(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const dir = join(root, entry);
      if (!(await isRepo(dir))) continue;
      const planned = await Bun.file(join(dir, "docs/ladder.json")).exists();
      const started = await Bun.file(join(dir, STATE_PATH)).exists();
      found.push({
        dir,
        name: entry,
        phase: started ? (planned ? "building" : "planning") : planned ? "ready" : "new",
      });
    }
  }
  // Anything in flight first. 60-odd repos in a sidebar is a list; four active
  // ones at the top is a view.
  const rank = { building: 0, planning: 0, ready: 1, new: 2 } as Record<string, number>;
  return found.sort(
    (a, b) => (rank[a.phase] ?? 9) - (rank[b.phase] ?? 9) || a.name.localeCompare(b.name),
  );
};

const readState = async (dir: string): Promise<State | null> => {
  const file = Bun.file(join(dir, STATE_PATH));
  if (!(await file.exists())) return null;
  try {
    return State.parse(await file.json());
  } catch {
    return null;
  }
};

const readLadder = async (dir: string) => {
  const file = Bun.file(join(dir, "docs/ladder.json"));
  if (!(await file.exists())) return planningLadder(basename(dir), `build/${basename(dir)}`);
  try {
    return await file.json();
  } catch {
    return null;
  }
};

const snapshot = async (dir: string) => ({
  dir,
  name: basename(dir),
  running: live.has(dir),
  terminalOpen: openTerminals.has(dir),
  state: await readState(dir),
  ladder: await readLadder(dir),
  log: lines(dir).slice(-200),
});

// --- doing things -----------------------------------------------------------

const start = (dir: string) => {
  if (live.has(dir)) return;
  logs.set(dir, [...lines(dir), `\n$ orchestrator run\n`]);

  const proc = Bun.spawn(["bun", RUN, "run"], {
    cwd: dir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ORCHESTRATOR_APP: "1" },
    onExit: () => {
      live.delete(dir);
    },
  });

  const decoder = new TextDecoder();
  const drain = async (stream: ReadableStream<Uint8Array>) => {
    for await (const chunk of stream) {
      logs.set(dir, [...lines(dir), decoder.decode(chunk, { stream: true })].slice(-400));
    }
  };
  void drain(proc.stdout as ReadableStream<Uint8Array>);
  void drain(proc.stderr as ReadableStream<Uint8Array>);

  live.set(dir, { proc, log: [] });
};

// Projects the window is looking at, and the ones Luis stopped by hand.
const watched = new Set<string>();
const halted = new Set<string>();
const lastAuto = new Map<string, number>();
const rechecking = new Set<string>();

// A project with state, nothing running, nothing to ask and not finished is a
// project that stopped mid-flight: a conversation just closed, or a process
// died. Either way it should carry on, and nobody should have to press a
// button to say so. This reads the state file rather than remembering anything,
// so restarting the server does not strand a build.
setInterval(() => {
  void (async () => {
    for (const dir of watched) {
      if (live.has(dir) || halted.has(dir)) continue;
      if (Date.now() - (lastAuto.get(dir) ?? 0) < 30_000) continue;
      const st = await readState(dir);
      if (!st || st.done) continue;

      // A check that proved nothing may have been fixed since we parked on it.
      // Re-run it: if it bites now, the park is stale and the build can go on
      // without anyone pressing anything.
      if (st.park?.kind === "tautology" && !rechecking.has(dir)) {
        const ladder = await readLadder(dir);
        const rung = ladder?.rungs?.find((r: { id: string }) => r.id === st.park!.rungId);
        if (rung?.oracle?.kind === "command") {
          rechecking.add(dir);
          const probe = Bun.spawn(["bash", "-c", rung.oracle.run], {
            cwd: dir,
            stdout: "ignore",
            stderr: "ignore",
          });
          void probe.exited.then((code) => {
            rechecking.delete(dir);
            if (code !== 0 && !live.has(dir) && !halted.has(dir)) {
              lastAuto.set(dir, Date.now());
              logs.set(dir, [...lines(dir), "\nthe check bites now, carrying on\n"]);
              start(dir);
            }
          });
        }
        continue;
      }

      if (st.park !== null) continue;
      lastAuto.set(dir, Date.now());
      logs.set(dir, [...lines(dir), "\ncarrying on\n"]);
      start(dir);
    }
  })();
}, 2000);

const stop = (dir: string) => {
  live.get(dir)?.proc.kill();
  live.delete(dir);
};

// A conversation needs a real terminal, so it gets one. wezterm is the default;
// anything else on the box works through x-terminal-emulator.
const openTerminals = new Map<string, Bun.Subprocess>();

const terminal = (dir: string, argv: string[]) => {
  const inner = argv.map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(" ");
  const candidates = [
    ["wezterm", "start", "--always-new-process", "--cwd", dir, "--", "bash", "-lc", `${inner}; exec bash`],
    ["gnome-terminal", `--working-directory=${dir}`, "--", "bash", "-lc", `${inner}; exec bash`],
    ["x-terminal-emulator", "-e", `bash -lc "${inner}; exec bash"`],
  ];
  for (const cmd of candidates) {
    if (!Bun.which(cmd[0]!)) continue;
    const proc = Bun.spawn(cmd, { cwd: dir, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
    openTerminals.set(dir, proc);
    void proc.exited.then(() => {
      if (openTerminals.get(dir) === proc) openTerminals.delete(dir);
    });
    return cmd[0];
  }
  return null;
};

// Two ways out of a check that proves nothing. Either the check is wrong, which
// a session can fix, or the work really is already in the tree, which only Luis
// can know.
const overrideRedFirst = async (dir: string, rungId: string) => {
  const path = join(dir, "docs/ladder.json");
  const ladder = (await Bun.file(path).json()) as { rungs: Record<string, unknown>[] };
  const rung = ladder.rungs.find((r) => r.id === rungId);
  if (!rung) return false;
  rung.expectRedFirst = false;
  await Bun.write(path, JSON.stringify(ladder, null, 2) + "\n");
  return true;
};

const fixCheckPrompt = (rungId: string, check: string, milestones: string[]) =>
  [
    `The check for ${rungId} passes before any of its work has been done, so it`,
    `cannot tell a finished milestone from an unstarted one. The check is:`,
    "",
    `    ${check}`,
    "",
    `Read docs/milestones/${milestones[0]}.md for what this milestone is supposed`,
    `to deliver, then make the check actually measure it: it must fail right now,`,
    `on the current tree, and pass only once the milestone lands. Usually that`,
    `means the verify script asserts against real behaviour instead of existing.`,
    "",
    `Then do the same for every other verify script that is still a stub. They`,
    `were all scaffolded together, so they will all fail this way one rung at a`,
    `time, and fixing them one at a time wastes a stop for each. Each script`,
    `asserts what its own milestone's card says it delivers, and each must fail`,
    `on today's tree.`,
    "",
    `Edit the scripts and, where a command needs to change, docs/ladder.json and`,
    `docs/plan.md so all three agree. Then run every check in the ladder and show`,
    `me which now fail, which should be all of them except the milestones already`,
    `built. Do not implement any milestone. Do not commit.`,
  ].join("\n");

const cli = async (dir: string, args: string[]) => {
  const r = Bun.spawn(["bun", RUN, ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" });
  const out = await new Response(r.stdout).text();
  await r.exited;
  logs.set(dir, [...lines(dir), out]);
  return out;
};

// --- the server -------------------------------------------------------------

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const dir = url.searchParams.get("dir") ?? "";
    const body = req.method === "POST" ? ((await req.json()) as Record<string, string>) : {};
    const target = body.dir ?? dir;

    switch (url.pathname) {
      case "/":
        return new Response(Bun.file(PAGE), { headers: { "content-type": "text/html" } });

      case "/api/projects":
        return json(await projects());

      case "/api/snapshot":
        watched.add(target);
        return json(await snapshot(target));

      // One long-lived stream per open project. Polling on the server side is
      // fine here: it reads two small files, and it keeps the page dumb.
      case "/api/events": {
        watched.add(target);
        const stream = new ReadableStream({
          async start(controller) {
            const send = async () => {
              const payload = JSON.stringify(await snapshot(target));
              controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
            };
            await send();
            const timer = setInterval(() => void send().catch(() => clearInterval(timer)), 1000);
            req.signal.addEventListener("abort", () => {
              clearInterval(timer);
              controller.close();
            });
          },
        });
        return new Response(stream, {
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        });
      }

      case "/api/start":
        halted.delete(target);
        watched.add(target);
        start(target);
        return json({ ok: true });

      case "/api/stop":
        halted.add(target);
        stop(target);
        return json({ ok: true });

      case "/api/answer": {
        stop(target);
        await cli(target, ["answer", body.rung!, body.pass === "yes" ? "pass" : "fail", body.note ?? ""]);
        start(target);
        return json({ ok: true });
      }

      case "/api/converse": {
        stop(target);
        const used = terminal(target, ["bun", RUN, "converse", body.rung!]);
        if (used) {
          halted.delete(target);
          watched.add(target);
        }
        return json({ ok: Boolean(used), terminal: used });
      }

      case "/api/session": {
        const used = terminal(target, ["claude", "--resume", body.session!]);
        return json({ ok: Boolean(used), terminal: used });
      }

      case "/api/override": {
        const ok = await overrideRedFirst(target, body.rung!);
        if (ok) {
          halted.delete(target);
          watched.add(target);
          start(target);
        }
        return json({ ok });
      }

      case "/api/fixcheck": {
        stop(target);
        const ladder = await readLadder(target);
        const rung = ladder?.rungs?.find((r: { id: string }) => r.id === body.rung);
        if (!rung) return json({ ok: false });
        const used = terminal(target, [
          "claude",
          fixCheckPrompt(rung.id, rung.oracle?.run ?? "", rung.milestones ?? []),
        ]);
        if (used) {
          halted.delete(target);
          watched.add(target);
        }
        return json({ ok: Boolean(used) });
      }

      case "/api/resume":
        halted.delete(target);
        watched.add(target);
        start(target);
        return json({ ok: true });

      default:
        return new Response("not found", { status: 404 });
    }
  },
});

console.log(`orchestrator app on http://127.0.0.1:${server.port}`);
