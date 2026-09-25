/* A second gate of one tree, refused before it writes a line: two gates over one tree read and write one record at once and
   the later answers about neither, which cost a run twenty minutes on an `unproved` it could do nothing with (ISS-1705). Half
   against a process table this case writes, half against a real gate held open in its step. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DECLINED, gatesOn, heldSaid, outputOf, placeFor, treeHeldBy } from "../../../gates/machine.mjs";
import { DEADLINE, DEFAULT_MINUTES, verdictRuns } from "../../../gates/verdict.mjs";
import { WAIT_COMMAND } from "../../../../plugin/src/hooks/wait-idiom.mjs";
import { configHome, entryNames, HANGS_IN, HOLDING, procTable, RUNNER, runsFile, scratch, SHELL_ENV }
  from "../scratch.mjs";
import { heard, waited } from "../wait/waiting.mjs";
import { patience } from "../../../../plugin/test/patience.mjs";
import { tempRoom } from "../../../../plugin/test/fixtures.mjs";

const TREE = "/w/one";
const OTHER = "/w/two";
const ours = new Set([join(TREE, "tools", "gates.mjs"), join(OTHER, "tools", "gates.mjs")]);
const gate = (start, pid, cwd = TREE, extra = []) =>
  ({ start, pid, cwd, argv: ["/usr/bin/node", "tools/gates.mjs", ...extra] });

test("the later of two gates of one tree is held by the earlier, and the earlier by nothing", () => {
  const at = procTable([gate(5, 3000, OTHER), gate(10, 3001), gate(20, 3002), gate(30, 3003)]);
  try {
    assert.equal(treeHeldBy(TREE, ours, { proc: at, pid: 3003 })?.pid, 3001,
      "the earliest gate of this tree ahead of this one is the holder, never another tree's");
    assert.equal(treeHeldBy(TREE, ours, { proc: at, pid: 3001 }), null,
      "the first gate of the tree was refused on account of one the kernel started after it");
    assert.equal(treeHeldBy(OTHER, ours, { proc: at, pid: 3000 }), null, "a gate of another worktree held this one");
    assert.equal(treeHeldBy(OTHER, ours, { proc: "/no/such/proc", pid: 3000 }), null,
      "a table that cannot be read refused a gate");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The claim the three sightings of 2026-09-24 carried, that a queued wait took one of the places: a wait runs no gate, and
   counted it would hold a tree that has nothing running and turn a landing's gate away for a process that judges nothing. */
test("a wait for a verdict and a wait for a place are counted as no gate, by the tree's refusal or by the ceiling", () => {
  const at = procTable([gate(10, 3001, TREE, ["--wait", "9"]), gate(20, 3002, TREE, ["--wait", "slot", "9"])]);
  try {
    assert.deepEqual(gatesOn(ours, at), [], "a wait was read as a gate");
    assert.equal(treeHeldBy(TREE, ours, { proc: at, pid: 3009 }), null, "a wait held its own tree against a gate");
    assert.equal(placeFor(ours, { proc: at, declared: { value: 1, from: "the case" }, pid: 3009 }).declined, false,
      "a wait took the one place the case declares");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* By what the descriptor opens, never by its name: a regular file under /dev/shm is a log, and /dev/null is not one. */
test("where a gate's output goes is named only where it is a regular file", () => {
  const room = tempRoom("gate-out-");
  const log = join(room, "gate.log");
  writeFileSync(log, "");
  const shm = existsSync("/dev/shm") ? join("/dev/shm", `gate-${process.pid}.log`) : null;
  if (shm) writeFileSync(shm, "");
  const rows = [[log, log], ...(shm ? [[shm, shm]] : []), ["pipe:[4242]", null], ["socket:[4242]", null],
    ["/dev/null", null], [room, null]];
  const at = procTable(rows.map(([out], nth) => ({ ...gate(10 + nth, 4000 + nth), out })));
  try {
    for (const [nth, [out, named]] of rows.entries()) assert.equal(outputOf(4000 + nth, at), named, out);
    assert.equal(outputOf(4999, at), null, "a process with no descriptor to read named a file");
  } finally {
    for (const one of [at, room, shm].filter(Boolean)) rmSync(one, { recursive: true, force: true });
  }
});

test("the refusal says which of the two its holder's output is, and its route is the wait on that pid", () => {
  const holder = { pid: 4321, tree: TREE };
  const nowhere = heldSaid(TREE, holder, { output: null, seconds: 540 });
  assert.ok(nowhere.includes(`pid 4321  gating ${TREE}  its output reaches no file`), nowhere);
  const logged = heldSaid(TREE, holder, { output: "/tmp/gate.log", seconds: 540 });
  assert.ok(logged.includes(`pid 4321  gating ${TREE}  writing to /tmp/gate.log`), logged);
  assert.ok(logged.includes(`Wait for it: ${WAIT_COMMAND.replace("<seconds>", "540").replace("<pid>", "4321")}`), logged);
});

// Its whole group, the step it hangs in included, as the held gates of the other cases are stopped.
const stopped = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  process.kill(-child.pid, "SIGKILL");
  await new Promise((done) => child.once("exit", done));
};

// Its output to a file, which is how a run that backgrounds a gate holds it, and the only shape whose log a refusal can name.
const loggedGate = (work, log) => {
  const fd = openSync(log, "w");
  const child = spawn(process.execPath, [join(work, RUNNER)], { cwd: work, detached: true,
    env: { ...SHELL_ENV, XDG_CONFIG_HOME: configHome(work) }, stdio: ["ignore", fd, "ignore"] });
  closeSync(fd);
  return child;
};

/* Bounded, and its whole group killed at the bound: a second gate nothing refuses reaches the same hanging step as the first,
   and a case that waited on it would wait out that step's ten minutes rather than go red. */
const secondGate = (work) => new Promise((done) => {
  const child = spawn(process.execPath, [join(work, RUNNER)], { cwd: work, detached: true,
    env: { ...SHELL_ENV, XDG_CONFIG_HOME: configHome(work) }, stdio: ["ignore", "pipe", "pipe"] });
  const said = { stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => { said.stdout += chunk; });
  child.stderr.on("data", (chunk) => { said.stderr += chunk; });
  const bound = setTimeout(() => process.kill(-child.pid, "SIGKILL"), patience(30_000));
  child.once("exit", (status) => {
    clearTimeout(bound);
    done({ ...said, status });
  });
});

const reachedInLog = async (child, log) => {
  const until = Date.now() + patience(120_000);
  while (!readFileSync(log, "utf8").includes(HOLDING)) {
    if (child.exitCode !== null) throw new Error(`the held gate exited ${child.exitCode}:\n${readFileSync(log, "utf8")}`);
    if (Date.now() > until) throw new Error(`the held gate never reached its step:\n${readFileSync(log, "utf8")}`);
    await new Promise((tick) => setTimeout(tick, 100));
  }
};

test("a second gate of one tree is refused having spent no step, names the first and its log, and leaves the record alone", async () => {
  const { at, work } = scratch("one-tree", null, null, { hanging: HANGS_IN });
  const log = join(at, "first.log");
  const first = loggedGate(work, log);
  try {
    await reachedInLog(first, log);
    const before = verdictRuns(work);
    const second = await secondGate(work);
    const said = second.stderr;
    assert.equal(second.status, DECLINED, `${second.stdout}${said}`);
    assert.equal(second.stdout, "", "the refused gate printed a step or a verdict line");
    assert.ok(said.includes(`pid ${first.pid}  gating ${work}  writing to ${log}`), said);
    assert.ok(said.includes(WAIT_COMMAND.replace("<seconds>", String(DEFAULT_MINUTES * 60))
      .replace("<pid>", String(first.pid))), `the route is not the wait on the running gate:\n${said}`);
    assert.deepEqual(entryNames(work), [], "the refused gate recorded a pass");
    assert.throws(() => readFileSync(runsFile(work)), "the refused gate recorded a run figure");
    assert.deepEqual(verdictRuns(work), before, "the refused gate wrote to the record a wait reads");
    const heardIt = heard();
    assert.equal(await waited(work, heardIt), DEADLINE, heardIt.lines.join("\n"));
    assert.ok(heardIt.lines.join("\n").includes(`(pid ${first.pid})`),
      "a wait after the refusal is not attached to the gate still running");
  } finally {
    await stopped(first);
    rmSync(at, { recursive: true, force: true });
  }
});
