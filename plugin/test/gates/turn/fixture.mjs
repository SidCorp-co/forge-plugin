/* What both stop-check suites stand on: the gate loaded under a home of the suite's own, a turn
   written as a transcript, a worktree and a process to find in it, and the clock a case pins. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { cleanRepo, projectRecord, tempRoom } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

export const REPO = new URL("../../../..", import.meta.url).pathname.replace(/\/$/u, "");

/* Set before the gate is loaded and not after: the consult log's path is read once, at the import,
   and this suite must not read the developer's own log. Where its stamps land is the fixture's,
   which pointed `TMPDIR` at this process's own root before this line ran. */
process.env.XDG_CONFIG_HOME = tempRoom("stop-check-own-");
/* The project a case standing the gate here resolves, under a home of the suite's own: the roles
   whose stops are judged are one of its keys, and the record is this machine's rather than the
   tree's, so nothing is resolved until this home carries one. */
projectRecord(REPO, process.env.XDG_CONFIG_HOME, OWN);
export const { run, silentSince, judgedStop, heldAndSilent } = await import("../../../hooks/gates/turn/stop-check.mjs");

export const AT = "2026-09-01T10:00:00.000Z";
export const prompt = { type: "user", promptSource: "typed", timestamp: AT, message: { content: "go" } };
export const used = (name, input) => ({
  type: "assistant",
  timestamp: "2026-09-01T10:01:00.000Z",
  message: { content: [{ type: "tool_use", name, input }] },
});

export const transcript = (...records) => written([prompt, ...records]);

export const written = (records) => {
  const path = join(tempRoom("stop-check-turn-"), "t.jsonl");
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  return path;
};

export const git = (dir, ...argv) =>
  spawnSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { cwd: dir, encoding: "utf8" });

/* A worktree cut fresh for each case, so one case's leftover process is never read by another's. */
export const freshWorktree = () => {
  const checkout = cleanRepo();
  const wt = join(tempRoom("stop-check-live-wt-"), "wt");
  assert.equal(git(checkout, "worktree", "add", "-q", "-b", `side-${randomUUID().slice(0, 8)}`, wt).status, 0);
  return { checkout, wt };
};

/* Detached the way a backgrounded ship or gate is: a shell that exits leaves this reparented, cwd
   the only thing left naming the tree it belongs to. */
export const spawnIn = (tree) => {
  const child = spawn("sleep", ["5"], { cwd: tree, detached: true, stdio: "ignore" });
  child.unref();
  return child.pid;
};

export const stopStanding = (pid) => {
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // already gone, which is what the case wanted anyway
  }
};

export const settled = (ms = 150) => new Promise((r) => setTimeout(r, ms));

/* Every answer is thrown — silence included — so what a decision was is read off what it carried. */
export const decided = (ev, held, clock = () => performance.timeOrigin) => {
  /* In this process the event's clock runs from the file's own start, so the case pins it there: a
     case late in a loaded run otherwise finds its readings spent by the neighbours (ISS-1205). A case
     about the clock itself hands its own. */
  const live = Date.now;
  Date.now = clock;
  try {
    run(ev, held);
  } catch (answer) {
    return { kind: answer.kind, said: answer.message };
  } finally {
    Date.now = live;
  }
  return { kind: "returned", said: "" };
};
