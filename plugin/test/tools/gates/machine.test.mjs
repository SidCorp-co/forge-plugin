/* The ceiling, watched firing both ways. Half against a process table this case writes, where every
   interleaving is reachable, and half against two real gates, where the count is the kernel's own
   and nothing here decides what it reads (ISS-917). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DECLINED, gatesOn, placeFor, runnersOf } from "../../../../tools/gates/machine.mjs";
import { STEPS } from "../../../../tools/gates/steps.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { entryNames, HOLDING, heldGate, run, runsFile, scratch, stopGate, write } from "./scratch.mjs";

const TICK = 100;

/* One directory per process, the three files the count reads. `cwd` is a link because /proc's is,
   and a relative runner path in a command line resolves against nothing else. */
const table = (rows) => {
  const at = tempRoom("proc-");
  for (const [nth, row] of rows.entries()) {
    const pid = row.pid ?? 1000 + nth;
    const dir = join(at, String(pid));
    mkdirSync(dir);
    writeFileSync(join(dir, "cmdline"), `${row.argv.join("\0")}\0`);
    writeFileSync(join(dir, "stat"), `${pid} (node) R 1 ${pid} ${pid} `
      + `${new Array(16).fill("0").join(" ")} ${row.start * TICK}\n`);
    symlinkSync(row.cwd ?? at, join(dir, "cwd"));
  }
  return at;
};

const ours = (tree) => new Set([join(tree, "tools", "gates.mjs")]);

const TREE = "/w/one";
const gate = (start, pid, cwd = TREE) =>
  ({ start, pid, cwd, argv: ["/usr/bin/node", "tools/gates.mjs", "--full"] });

test("the gates of this checkout are found, oldest first, and nothing else is", () => {
  const at = table([
    gate(50, 3003),
    gate(10, 3001),
    { start: 20, pid: 3002, cwd: TREE, argv: ["/usr/bin/node", "--test", "one.test.mjs"] },
    { start: 30, pid: 3004, cwd: "/w/other", argv: ["/usr/bin/node", "tools/gates.mjs"] },
    { start: 40, pid: 3005, cwd: TREE, argv: ["/usr/bin/grep", "-n", "x", "tools/gates.mjs"] },
    { start: 60, pid: 3006, cwd: TREE, argv: ["/usr/bin/node", "watcher.mjs", "tools/gates.mjs"] },
    { start: 70, pid: 3007, cwd: TREE, argv: ["/usr/bin/node", "--check", "tools/gates.mjs"] },
    { start: 80, pid: 3008, cwd: TREE, argv: ["/usr/bin/nodemon", "tools/gates.mjs"] },
    { start: 90, pid: 3009, cwd: TREE, argv: ["/usr/bin/node", "-e", "tools/gates.mjs"] },
  ]);
  try {
    assert.deepEqual(gatesOn(ours(TREE), at).map((one) => one.pid), [3001, 3003],
      "only the two gates of this tree: a suite, another checkout's gate, a grep, a watcher handed "
      + "the path, a syntax check, nodemon and an eval all name a runner and run none");
    assert.deepEqual(gatesOn(ours(TREE), at).map((one) => one.tree), [TREE, TREE]);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* A gate spelled another way is the same gate: what a path compares as is what resolving it against
   the process's own directory makes of it, never the letters the command line happened to carry. */
test("a gate whose command line spells its runner another way is counted all the same", () => {
  const at = table([
    { start: 10, pid: 3001, cwd: TREE, argv: ["/usr/bin/node", "tools/./gates.mjs", "--full"] },
    { start: 20, pid: 3002, cwd: "/", argv: ["/usr/bin/node", `${TREE}/tools/../tools/gates.mjs`] },
  ]);
  try {
    assert.deepEqual(gatesOn(ours(TREE), at).map((one) => one.pid), [3001, 3002]);
    const declared = { value: 1, from: "the case" };
    assert.equal(placeFor(ours(TREE), { proc: at, declared, pid: 3001 }).declined, false);
    assert.equal(placeFor(ours(TREE), { proc: at, declared, pid: 3002 }).declined, true,
      "a runner spelled with a dot went uncounted, so both gates admitted themselves");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The pair the ceiling turns on, read twice off one table: the same two gates are both admitted
   where there is room for three and resolve to one admission where there is room for one. */
test("of two gates the earlier is admitted and the later declined, and neither is at a higher number", () => {
  const at = table([gate(10, 3001), gate(20, 3002)]);
  const declared = (value) => ({ value, from: "the case" });
  const place = (pid, value) => placeFor(ours(TREE), { proc: at, declared: declared(value), pid });
  try {
    assert.equal(place(3001, 1).declined, false, "the earlier of the two got in");
    assert.equal(place(3002, 1).declined, true, "the later of the two did not");
    assert.deepEqual(place(3002, 1).ahead.map((one) => one.pid), [3001], "and it says which gate it waited on");
    assert.equal(place(3001, 3).declined, false);
    assert.equal(place(3002, 3).declined, false, "at three neither is declined");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a machine that declares no number counts nothing and declines nobody", () => {
  const at = table([gate(10, 3001), gate(20, 3002), gate(30, 3003)]);
  try {
    const place = placeFor(ours(TREE), { proc: at, declared: { value: null, from: "the plugin's default" }, pid: 3003 });
    assert.equal(place.declined, false);
    assert.deepEqual(place.ahead, [], "with no number there is nothing to be ahead of");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a machine whose process table cannot be read declines nobody", () => {
  const place = placeFor(ours(TREE), { proc: "/no/such/proc", declared: { value: 1, from: "the case" }, pid: 3001 });
  assert.equal(gatesOn(ours(TREE), "/no/such/proc"), null, "an unreadable table is not an empty one");
  assert.equal(place.declined, false);
});

test("a gate whose process has ended is not counted against the next one", () => {
  const at = table([gate(10, 3001)]);
  try {
    const declared = { value: 1, from: "the case" };
    assert.equal(placeFor(ours(TREE), { proc: at, declared, pid: 3002 }).declined, true);
    rmSync(join(at, "3001"), { recursive: true, force: true });
    assert.equal(placeFor(ours(TREE), { proc: at, declared, pid: 3002 }).declined, false,
      "the ended gate freed the place by ending, there being no record of it to reclaim");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("every worktree of this checkout has a runner, and each is named whole", () => {
  const held = runnersOf(process.cwd());
  assert.ok(held.size > 0, "this checkout reports no worktree at all");
  for (const one of held) assert.match(one, /\/tools\/gates\.mjs$/u);
  assert.ok([...held].some((one) => one.startsWith(process.cwd())), `this tree is not among them: ${[...held]}`);
});

/* Real gates of one scratch, which is what proves the count is the machine's own and not this case's
   table. A gate held inside a step that never returns has reached that step, so a second one that
   also reaches it was admitted, and one that declines says so instead of getting there. */
const HANGS_IN = STEPS.find((step) => !step.tests).label;

const reachedTheStep = (child, why) => new Promise((done, fail) => {
  let said = "";
  const both = (chunk) => {
    said += chunk;
    if (said.includes(HOLDING)) done(said);
  };
  child.stdout.on("data", both);
  child.stderr.on("data", both);
  child.once("exit", (code) => fail(new Error(`${why}: it exited ${code} instead\n${said}`)));
});

const room = (name, keys) => {
  const held = scratch(name, null, null, { hanging: HANGS_IN });
  if (keys) write(join(held.work, ".."), join("config", "forge", "config.json"), JSON.stringify(keys));
  return held;
};

test("a second gate of one checkout declines the machine, says every clause it owes, and the place comes back when the first has gone", async () => {
  const { at, work } = room("machine-ceiling", { runs: 1 });
  const ours = new Set([join(work, "tools", "gates.mjs")]);
  const declared = { value: 1, from: "the case" };
  const first = heldGate(work, ["--full"]);
  try {
    await reachedTheStep(first, "the gate this case holds open never reached its hanging step");
    const second = run(work, ["--full"]);
    assert.equal(second.status, DECLINED, `${second.stdout}${second.stderr}`);
    assert.notEqual(DECLINED, 1, "a declined machine and a refused tree exit the same status");
    const said = second.stderr;
    assert.match(said, /This gate declined the machine and judged nothing/u, said);
    assert.match(said, /1 gate\(s\) of this checkout are already running/u, "the count it read");
    assert.match(said, /carries 1 run\(s\) at once {2}← \S+config\.json/u, "the number and where it came from");
    assert.match(said, new RegExp(`pid ${first.pid} {2}gating ${work}`, "u"), "the gate it counted, and that gate's tree");
    assert.match(said, /forge doctor --runs 2/u, "the one command that raises it");
    assert.ok(said.includes(`nothing here judges ${work}`), `it claimed something about the tree:\n${said}`);
    assert.deepEqual(entryNames(work), [], "a declined gate recorded a pass");
    assert.ok(!existsSync(runsFile(work)), "a declined gate recorded a run figure");
    assert.equal(placeFor(ours, { declared }).declined, true, "the held gate is not the one being counted");
    await stopGate(first);
    assert.equal(placeFor(ours, { declared }).declined, false,
      "the place the gate held was not freed by that gate ending");
  } finally {
    await stopGate(first);
    rmSync(at, { recursive: true, force: true });
  }
});

test("a machine that declares no number lets a second gate of the same checkout run beside the first", async () => {
  const { at, work } = room("machine-unset", null);
  const first = heldGate(work, ["--full"]);
  const second = heldGate(work, ["--full"]);
  try {
    await reachedTheStep(first, "the first gate never reached its hanging step");
    await reachedTheStep(second, "a machine that declared nothing turned the second gate away");
  } finally {
    await Promise.all([stopGate(first), stopGate(second)]);
    rmSync(at, { recursive: true, force: true });
  }
});
