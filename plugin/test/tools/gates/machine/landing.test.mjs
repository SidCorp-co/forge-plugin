/* A landing's gate ahead of a builder's for the next place, watched on a process table this case writes, where the
   interleaving a real pair only races into is reachable, and on real gates of one scratch, where the wait, the decline
   that names the landing and the deadline are the runner's own (ISS-2461). */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { DECLINED, LANDING_ENV, placeFor } from "../../../../../tools/gates/machine.mjs";
import { declinedSaid, LANDING_WAIT_ENV, landingAsked } from "../../../../../tools/gates/landing/wait.mjs";
import { escaped } from "../../../fixtures.mjs";
import { entryNames, HANGS_IN, heldGate, reachedTheStep, procTable as table, run, scratch, sibling, stopGate }
  from "../scratch.mjs";

const TREE = "/w/one";
const ours = new Set([join(TREE, "tools", "gates.mjs")]);
const argv = ["/usr/bin/node", "tools/gates.mjs", "--full"];
const builder = (start, pid) => ({ start, pid, cwd: TREE, argv });
const landing = (start, pid, keys = "ISS-9") => ({ start, pid, cwd: TREE, argv, env: { [LANDING_ENV]: keys } });
const declared = (value) => ({ value, from: "the case" });

const on = (rows, work) => {
  const at = table(rows);
  try {
    return work(at);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
};

test("a builder's gate counts a landing's gate the kernel started after it, and says the landing took the place", () => {
  on([builder(10, 3001), builder(20, 3002), landing(30, 3003)], (at) => {
    const place = placeFor(ours, { proc: at, declared: declared(2), pid: 3002 });
    assert.equal(place.declined, true, "by start order alone the builder had the second place");
    assert.deepEqual(place.ahead.map((one) => one.pid), [3001, 3003]);
    assert.deepEqual(place.took.map((one) => one.pid), [3003], "the landing is the one that took it");
    const said = declinedSaid(place, TREE);
    assert.ok(said.includes("1 gate(s) of this checkout are already running"), said);
    assert.ok(said.includes(`pid 3003  gating ${TREE}  the landing of ISS-9`), `the landing's gate, keys, pid and tree:\n${said}`);
    assert.ok(said.includes("ISS-9 (pid 3003) took it"), said);
  });
});

test("a builder's gate the gates before it already decline says no landing took its place", () => {
  on([builder(10, 3001), builder(20, 3002), landing(30, 3003)], (at) => {
    const place = placeFor(ours, { proc: at, declared: declared(1), pid: 3002 });
    assert.equal(place.declined, true);
    assert.doesNotMatch(declinedSaid(place, TREE), /took it/u, "the gate started first held the only place");
  });
});

test("a landing's gate counts only the gates started before it, so it never runs past the number", () => {
  on([builder(10, 3001), landing(20, 3002), builder(30, 3003)], (at) => {
    const mine = placeFor(ours, { proc: at, declared: declared(2), pid: 3002 });
    assert.equal(mine.declined, false, "one gate before it, under two");
    assert.deepEqual(mine.ahead.map((one) => one.pid), [3001], "the builder started after it is not ahead of it");
    assert.deepEqual(mine.took, []);
    assert.equal(placeFor(ours, { proc: at, declared: declared(1), pid: 3002 }).declined, true,
      "the one place is held by a gate started before it, and a landing does not run past it");
    const later = placeFor(ours, { proc: at, declared: declared(2), pid: 3003 });
    assert.equal(later.declined, true, "the builder after an admitted landing counts that landing like any gate");
    assert.deepEqual(later.took, [], "and no landing took from it what it never had");
  });
});

test("a wait of the runner is counted by no gate, a landing's wait included", () => {
  const waits = { start: 5, pid: 3000, cwd: TREE, argv: ["/usr/bin/node", "tools/gates.mjs", "--wait", "slot"],
    env: { [LANDING_ENV]: "ISS-9" } };
  on([waits, builder(10, 3001), landing(20, 3002)], (at) => {
    assert.deepEqual(placeFor(ours, { proc: at, declared: declared(2), pid: 3001 }).ahead.map((one) => one.pid), [3002]);
    assert.deepEqual(placeFor(ours, { proc: at, declared: declared(2), pid: 3002 }).ahead.map((one) => one.pid), [3001]);
  });
});

test("a gate whose environment cannot be read, or names no landing, is a builder's", () => {
  on([builder(10, 3001), { ...landing(20, 3002), env: { [LANDING_ENV]: " " } }, builder(30, 3003)], (at) => {
    const place = placeFor(ours, { proc: at, declared: declared(3), pid: 3001 });
    assert.deepEqual(place.took, [], "neither the blank landing nor the gate with no environ file is a landing");
  });
});

test("what land-ready hands a gate is used or refused, never dropped", () => {
  assert.deepEqual(landingAsked({}), { landing: null });
  assert.deepEqual(landingAsked({ [LANDING_ENV]: "ISS-1 ISS-2", [LANDING_WAIT_ENV]: "0.5" }),
    { landing: { keys: "ISS-1 ISS-2", minutes: 0.5 } });
  assert.deepEqual(landingAsked({ [LANDING_ENV]: "ISS-1" }), { landing: { keys: "ISS-1", minutes: 0 } });
  for (const raw of ["soon", "0", "-1", ""]) {
    assert.match(landingAsked({ [LANDING_ENV]: "ISS-1", [LANDING_WAIT_ENV]: raw }).refused ?? "",
      new RegExp(`not \`${escaped(raw)}\``, "u"), `the wait \`${raw}\``);
  }
  assert.match(landingAsked({ [LANDING_WAIT_ENV]: "3" }).refused ?? "", /names no landing/u);
});

/* Every process the kernel reports as a descendant of `root`, off each one's parent in /proc. */
const descendants = (root) => {
  const parents = new Map();
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/u.test(name)) continue;
    try {
      const stat = readFileSync(join("/proc", name, "stat"), "utf8");
      parents.set(Number(name), Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]));
    } catch {
      /* gone between the listing and the read */
    }
  }
  const found = new Set([root]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [pid, parent] of parents) {
      if (found.has(parent) && !found.has(pid)) {
        found.add(pid);
        grew = true;
      }
    }
  }
  found.delete(root);
  return [...found];
};

const environOf = (pid) => {
  try {
    return readFileSync(join("/proc", String(pid), "environ"), "utf8");
  } catch {
    return "";
  }
};

/* Refused where the gate exits first, so a gate that declined at once fails this case rather than hanging it. */
const saying = (child, text) => new Promise((done, fail) => {
  let said = "";
  const both = (chunk) => {
    said += chunk;
    if (said.includes(text)) done(said);
  };
  child.stdout.on("data", both);
  child.stderr.on("data", both);
  child.once("exit", (code) => fail(new Error(`the gate exited ${code} before saying \`${text}\`:\n${said}`)));
});

const room = (name) => scratch(name, null, null, { hanging: HANGS_IN, runs: 1 });

test("a landing's gate declined for a place waits in place, a builder meanwhile is declined naming it, and it runs once the place frees", async () => {
  const { at, work } = room("machine-landing-wait");
  const first = heldGate(work, ["--full"]);
  let theLanding = null;
  try {
    await reachedTheStep(first, "the builder's gate this case holds open never reached its hanging step");
    const other = sibling(work);
    theLanding = heldGate(other, ["--full"], { [LANDING_ENV]: "ISS-9", [LANDING_WAIT_ENV]: "2" });
    const waiting = await saying(theLanding, "waits up to 2 minute(s)");
    assert.match(waiting, /the gate of the landing of ISS-9/u, waiting);
    const third = run(sibling(work, "third"), ["--full"]);
    assert.equal(third.status, DECLINED, `${third.stdout}${third.stderr}`);
    assert.match(third.stderr, new RegExp(`pid ${theLanding.pid} {2}gating ${escaped(other)} {2}the landing of ISS-9`, "u"),
      third.stderr);
    const running = reachedTheStep(theLanding, "the landing's gate never ran its steps once the place freed");
    await stopGate(first);
    const said = await running;
    assert.match(said, /A place freed after .*, and the landing's gate runs now/u, said);
    const leaked = descendants(theLanding.pid).filter((pid) => environOf(pid).split("\0")
      .some((one) => one.startsWith(`${LANDING_ENV}=`) || one.startsWith(`${LANDING_WAIT_ENV}=`)));
    assert.deepEqual(leaked, [], "a step the landing's gate runs inherited the landing's marker");
  } finally {
    await stopGate(first);
    if (theLanding) await stopGate(theLanding);
    rmSync(at, { recursive: true, force: true });
  }
});

test("a landing's gate that waits out its minutes declines, saying how long and which gates held the places", async () => {
  const { at, work } = room("machine-landing-deadline");
  const first = heldGate(work, ["--full"]);
  try {
    await reachedTheStep(first, "the builder's gate this case holds open never reached its hanging step");
    const other = sibling(work);
    const gate = run(other, ["--full"], other, { [LANDING_ENV]: "ISS-9", [LANDING_WAIT_ENV]: "0.02" });
    assert.equal(gate.status, DECLINED, `${gate.stdout}${gate.stderr}`);
    assert.match(gate.stderr, /it waited \d+ second\(s\) for a place, the 0\.02 minute\(s\) the landing of ISS-9 gave it/u,
      gate.stderr);
    assert.match(gate.stderr, new RegExp(`pid ${first.pid} {2}gating ${escaped(work)}`, "u"), gate.stderr);
    assert.deepEqual(entryNames(other), [], "a declined landing's gate recorded a pass");
  } finally {
    await stopGate(first);
    rmSync(at, { recursive: true, force: true });
  }
});

test("a gate handed a landing wait that is not minutes refuses before any step, naming what it read", () => {
  const { at, work } = scratch("machine-landing-refused", null, null, { runs: 1 });
  try {
    const gate = run(work, ["--full"], work, { [LANDING_ENV]: "ISS-9", [LANDING_WAIT_ENV]: "soon" });
    assert.equal(gate.status, 1, `${gate.stdout}${gate.stderr}`);
    assert.ok(gate.stderr.includes("not `soon`"), gate.stderr);
    assert.doesNotMatch(gate.stdout, /===/u, `a step ran:\n${gate.stdout}`);
    assert.deepEqual(entryNames(work), []);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
