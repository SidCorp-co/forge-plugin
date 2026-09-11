/* The wait, on real gates of a scratch checkout of its own. Every case here is a state a log with no verdict in it cannot
   tell from any other, which is what left two runs of one wave parked on a notice nothing would send (ISS-1102): a gate
   still running, one killed at a step, one that never started, and one that finished while the run was elsewhere. */
import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, existsSync, rmSync } from "node:fs";

import { DEADLINE, gateDecided, gateStarted, gatesHere, GONE, NO_GATE, verdictPath, verdictRuns, waitForVerdict }
  from "../../../../tools/gate-verdict.mjs";
import { DECLINED } from "../../../../tools/gates/machine.mjs";
import { recordDir } from "../../../../tools/gates/timing.mjs";
import { STEPS } from "../../../../tools/gates/steps.mjs";
import { HANGS_IN, heldGate, reachedTheStep, run, scratch, stopGate } from "./scratch.mjs";

// Minutes, and a tick fast enough that a case waits on the state under test rather than on a constant.
const BRIEFLY = 0.02;
const TICK = 40;

const heard = () => {
  const lines = [];
  const collect = lines.push.bind(lines);
  return { lines, say: collect, warn: collect };
};

const waited = (work, said, minutes = BRIEFLY) => waitForVerdict(work, { minutes, tick: TICK, ...said });

const recordOf = (work) => verdictRuns(work).at(-1);

const holding = (name, runs = null) => scratch(name, null, null, { hanging: HANGS_IN, runs });

test("a wait for a tree no gate has ever run in says so at once and names what to start", async () => {
  const { at, work } = scratch("verdict-none");
  try {
    const said = heard();
    assert.equal(await waited(work, said, 30), NO_GATE, said.lines.join("\n"));
    const whole = said.lines.join("\n");
    assert.match(whole, /gate wait: no gate/u, whole);
    assert.ok(whole.includes(work), `it did not name the tree:\n${whole}`);
    assert.match(whole, /npm run check/u, "it named nothing to run");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a verdict already written answers at once, off the record, with its pid and its age", async () => {
  const { at, work } = scratch("verdict-written");
  try {
    const opened = gateStarted(work, { full: true });
    gateDecided(work, opened, { verdict: "pass", code: 0, seconds: 41, ran: 14, total: 14 });
    const said = heard();
    const began = Date.now();
    assert.equal(await waited(work, said, 30), 0, said.lines.join("\n"));
    assert.ok(Date.now() - began < 1000, "a verdict already written was waited for");
    const whole = said.lines.join("\n");
    assert.match(whole, /gate verdict: pass — 14 of 14 step\(s\) in 41s/u, whole);
    assert.match(whole, new RegExp(`pid ${opened.pid}`, "u"), "the pid that wrote it is not named");
    assert.match(whole, /head [0-9a-f]+, /u, "the head it judged is not named");
    assert.match(whole, /written \d+ second\(s\) ago/u, "the age of the verdict is not named");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The third outcome, and the one that strands a run: a gate that exited having written no verdict has ended its process,
   so anything waiting on the process reads it as finished and anything reading a log finds no line at all. */
test("a gate that started and is gone having written no verdict is a failed verdict, not a pass", async () => {
  const { at, work } = holding("verdict-killed");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case kills never reached its hanging step");
    const before = recordOf(work);
    assert.equal(before.verdict, null, "a running gate had already written a verdict");
    assert.equal(before.pid, gate.pid, "the record names a pid other than the gate's");
    await stopGate(gate);
    const said = heard();
    assert.equal(await waited(work, said, 30), GONE, said.lines.join("\n"));
    const whole = said.lines.join("\n");
    assert.match(whole, /gate verdict: failed/u, whole);
    assert.match(whole, /is gone having written no verdict/u, whole);
    assert.match(whole, new RegExp(`pid ${gate.pid}, is gone having written no verdict`, "u"), "the gate that vanished is not named");
    assert.ok(whole.includes(`nothing judged ${work}`), `it claimed something about the tree:\n${whole}`);
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

// Killed while the wait is armed, which no notification reports: the tick is what turns it into an answer.
test("a gate killed while the wait is armed answers the kill rather than waiting out the deadline", async () => {
  const { at, work } = holding("verdict-killed-waiting");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case kills never reached its hanging step");
    const said = heard();
    const answer = waited(work, said, 30);
    await stopGate(gate);
    assert.equal(await answer, GONE, said.lines.join("\n"));
    assert.match(said.lines.join("\n"), /gate verdict: failed/u, said.lines.join("\n"));
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

test("a wait on a running gate returns once, at the verdict that gate writes", async () => {
  const { at, work } = holding("verdict-running");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case waits on never reached its hanging step");
    const said = heard();
    const answer = waited(work, said, 30);
    const opened = recordOf(work);
    gateDecided(work, opened, { verdict: "failed", code: 1, step: STEPS.at(0).label });
    assert.equal(await answer, 1, said.lines.join("\n"));
    assert.equal(said.lines.length, 1, `it said more than the verdict:\n${said.lines.join("\n")}`);
    assert.match(said.lines[0], new RegExp(`gate verdict: failed — at the step ${STEPS.at(0).label}`, "u"), said.lines[0]);
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* The whole sequence as a real gate performs it: the verdict written, then the process gone, with the wait already armed. */
test("a gate that wrote its verdict and exited while the wait was armed answers with that verdict, not with gone", async () => {
  const { at, work } = holding("verdict-finished");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case finishes never reached its hanging step");
    const said = heard();
    const answer = waited(work, said, 30);
    gateDecided(work, recordOf(work), { verdict: "pass", code: 0, seconds: 9, ran: 14, total: 14 });
    await stopGate(gate);
    assert.equal(await answer, 0, said.lines.join("\n"));
    assert.match(said.lines.join("\n"), /gate verdict: pass — 14 of 14 step\(s\) in 9s/u, said.lines.join("\n"));
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* Driven through the table's own seam, because the race is one round wide: the record is read, the gate writes its verdict
   and exits, and the liveness answer comes back empty. Read once and that reads as a gate that vanished. */
test("a verdict written between one round's record read and its liveness answer is the answer, not a gate that vanished", async () => {
  const { at, work } = holding("verdict-interleaved");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case interleaves with never reached its hanging step");
    const opened = recordOf(work);
    let asked = 0;
    const gates = (root, ours) => {
      asked += 1;
      if (asked === 1) return gatesHere(root, ours);
      gateDecided(work, opened, { verdict: "pass", code: 0, seconds: 9, ran: 14, total: 14 });
      return [];
    };
    const said = heard();
    const answer = await waitForVerdict(work, { minutes: 30, tick: TICK, gates, ...said });
    assert.equal(answer, 0, said.lines.join("\n"));
    assert.equal(asked, 2, "the case did not drive the interleaving it is about");
    assert.match(said.lines.join("\n"), /gate verdict: pass — 14 of 14 step\(s\) in 9s/u, said.lines.join("\n"));
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* The directory is what `fs.watch` arms on, and the gate makes it when it writes; a wait that reaches it first would arm
   nothing, and `watching` unrefs its own ceiling, so the wait would exit having said nothing at all. */
test("a wait makes the directory it watches, so a tree whose gate has never written one is still watchable", async () => {
  const { at, work } = scratch("verdict-watchable");
  try {
    assert.equal(existsSync(recordDir(work)), false, "the scratch already holds the gate's record directory");
    const said = heard();
    assert.equal(await waited(work, said, 30), NO_GATE, said.lines.join("\n"));
    assert.ok(existsSync(recordDir(work)), "the wait left no directory for a notification to arrive in");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a wait that reaches its own deadline says it was the deadline and that the gate is still running", async () => {
  const { at, work } = holding("verdict-deadline");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case waits on never reached its hanging step");
    const said = heard();
    assert.equal(await waited(work, said), DEADLINE, said.lines.join("\n"));
    const whole = said.lines.join("\n");
    assert.match(whole, /gate wait: deadline/u, whole);
    assert.match(whole, /is still running/u, whole);
    assert.match(whole, new RegExp(`\\(pid ${gate.pid}\\)`, "u"), "the gate it is waiting on is not named");
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* Two gates of one tree, the second finishing while the first still runs: a record one gate could write over is a record
   that hands A's waiter B's answer, or tells it A wrote none. The wait reads the run it is attached to and no other. */
test("a verdict another gate of the tree wrote is not the answer, and the wait stands", async () => {
  const { at, work } = holding("verdict-strayed");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case waits on never reached its hanging step");
    const opened = recordOf(work);
    appendFileSync(verdictPath(work),
      `${JSON.stringify({ ...opened, pid: opened.pid + 100_000, verdict: "pass", code: 0, ran: 14, total: 14 })}\n`);
    const said = heard();
    assert.equal(await waited(work, said), DEADLINE, said.lines.join("\n"));
    const whole = said.lines.join("\n");
    assert.ok(!whole.includes("gate verdict: pass"), `it handed back another gate's verdict:\n${whole}`);
    assert.match(whole, new RegExp(`\\(pid ${gate.pid}\\)`, "u"), "the run it stayed attached to is not named");
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* A's verdict written, then B's over it, then A gone: the answer A's waiter is owed is A's own, and one line per run is
   what keeps it readable. Read as one record and this is A's waiter told that A wrote nothing. */
test("a verdict a second gate wrote over the first's is not what the first's waiter is handed", async () => {
  const { at, work } = holding("verdict-two-gates");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case waits on never reached its hanging step");
    const opened = recordOf(work);
    let asked = 0;
    const gates = (root, ours) => {
      asked += 1;
      if (asked === 1) return gatesHere(root, ours);
      gateDecided(work, opened, { verdict: "pass", code: 0, seconds: 9, ran: 14, total: 14 });
      gateDecided(work, { ...opened, pid: opened.pid + 100_000 }, { verdict: "declined", code: DECLINED });
      return [];
    };
    const said = heard();
    assert.equal(await waitForVerdict(work, { minutes: 30, tick: TICK, gates, ...said }), 0, said.lines.join("\n"));
    assert.match(said.lines.join("\n"), /gate verdict: pass — 14 of 14 step\(s\) in 9s/u, said.lines.join("\n"));
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* Observed running and then gone before writing anything: the record is absent, and answering `no gate` would send a run
   to start what this wait just watched fail. Driven through the seam, a gate dying inside that window being no case a real
   table produces to order. */
test("a gate watched running that died before writing its first record is gone, not a tree with no gate", async () => {
  const { at, work } = scratch("verdict-vanished");
  try {
    const pid = 999_001;
    let asked = 0;
    const gates = () => {
      asked += 1;
      return asked === 1 ? [{ pid, tree: work, start: 1 }] : [];
    };
    const said = heard();
    assert.equal(await waitForVerdict(work, { minutes: 30, tick: TICK, gates, ...said }), GONE, said.lines.join("\n"));
    const whole = said.lines.join("\n");
    assert.match(whole, new RegExp(`gate verdict: failed — the gate of this tree, pid ${pid}, is gone`, "u"), whole);
    assert.match(whole, /written no record of itself at all/u, whole);
    assert.ok(!whole.includes("no gate —"), `a gate it watched running was reported as a tree with none:\n${whole}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The record outlives its processes, so a pid alone is not a run: the kernel hands the same number out again, and a wait
   latching onto the new gate would be handed the verdict of the one that had it before. */
test("a gate holding a pid a finished gate had is not handed that gate's verdict", async () => {
  const { at, work } = scratch("verdict-reused-pid");
  try {
    const opened = gateStarted(work, { full: true });
    gateDecided(work, opened, { verdict: "pass", code: 0, seconds: 41, ran: 14, total: 14 });
    assert.ok(Number.isInteger(opened.start), "this machine records no process start, so the case proves nothing");
    let asked = 0;
    const gates = () => {
      asked += 1;
      return asked === 1 ? [{ pid: opened.pid, tree: work, start: opened.start + 1 }] : [];
    };
    const said = heard();
    assert.equal(await waitForVerdict(work, { minutes: 30, tick: TICK, gates, ...said }), GONE, said.lines.join("\n"));
    const whole = said.lines.join("\n");
    assert.ok(!whole.includes("gate verdict: pass"), `the run before it was handed back as this one's:\n${whole}`);
    assert.match(whole, /written no record of itself at all/u, whole);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* Lines from before the record carried an incarnation, and from a machine that could not read one: neither can prove it
   belongs to the gate this wait watched start, and a wait that took them anyway would keep the false pass it just closed. */
test("a line that names no incarnation is not handed to a wait that knows the one it is attached to", async () => {
  const { at, work } = scratch("verdict-legacy-pid");
  try {
    const opened = gateStarted(work, { full: true });
    const pass = { ...opened, verdict: "pass", code: 0, seconds: 41, ran: 14, total: 14, at: opened.started };
    delete pass.start;
    appendFileSync(verdictPath(work), `${JSON.stringify(pass)}\n${JSON.stringify({ ...pass, start: null })}\n`);
    let asked = 0;
    const gates = () => {
      asked += 1;
      return asked === 1 ? [{ pid: opened.pid, tree: work, start: 4242 }] : [];
    };
    const said = heard();
    assert.equal(await waitForVerdict(work, { minutes: 30, tick: TICK, gates, ...said }), GONE, said.lines.join("\n"));
    assert.ok(!said.lines.join("\n").includes("gate verdict: pass"), said.lines.join("\n"));
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("the answers a wait can give have no code in common", () => {
  const codes = [0, 1, DECLINED, GONE, DEADLINE, NO_GATE];
  assert.equal(new Set(codes).size, codes.length, `two answers exit the same way: ${codes.join(" ")}`);
});

test("a green run writes the verdict and prints it as the last thing it says, and a wait hands it back", async () => {
  const { at, work } = scratch("verdict-green");
  try {
    const said = run(work, ["--full"]);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    const last = said.stdout.trim().split("\n").at(-1);
    assert.match(last, new RegExp(`^gate verdict: pass — ${STEPS.length} of ${STEPS.length} step\\(s\\) in \\d+s`, "u"), last);
    assert.ok(last.endsWith(`the tree judged: ${work}`), `the terminal line does not name the tree:\n${last}`);
    assert.equal(recordOf(work).verdict, "pass");
    const heardIt = heard();
    assert.equal(await waited(work, heardIt, 30), 0, heardIt.lines.join("\n"));
    assert.match(heardIt.lines.join("\n"), /gate verdict: pass/u, heardIt.lines.join("\n"));
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a run whose step failed writes a failed verdict naming that step, and the wait exits the way the gate did", async () => {
  const { at, work } = scratch("verdict-red", STEPS.find((step) => !step.tests).label);
  try {
    const said = run(work, ["--full"]);
    assert.equal(said.status, 1, said.stdout + said.stderr);
    const last = said.stdout.trim().split("\n").at(-1);
    assert.match(last, new RegExp(`^gate verdict: failed — at the step ${STEPS.find((step) => !step.tests).label}`, "u"), last);
    const heardIt = heard();
    assert.equal(await waited(work, heardIt, 30), 1, heardIt.lines.join("\n"));
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* A decline judges nothing and says so, and it is the one outcome whose exit code a run could mistake for a verdict about
   the tree, so the record carries the word and the wait hands back 75 rather than a pass. */
test("a gate that declined the machine is read back as declined, not as a pass", async () => {
  const { at, work } = holding("verdict-declined", 1);
  const gate = heldGate(work, ["--full"]);
  try {
    await reachedTheStep(gate, "the gate holding the machine's only place never reached its hanging step");
    const said = run(work, ["--full"]);
    assert.equal(said.status, DECLINED, said.stdout + said.stderr);
    assert.equal(recordOf(work).verdict, "declined", said.stdout);
    assert.match(said.stdout.trim().split("\n").at(-1), /^gate verdict: declined — with no step spent/u, said.stdout);
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

test("a wait asked for beside --full is refused, and so is one given minutes that are not a number", () => {
  const { at, work } = scratch("verdict-refused");
  try {
    const both = run(work, ["--wait", "--full"]);
    assert.equal(both.status, 1, both.stdout + both.stderr);
    assert.match(both.stderr, /--wait runs no gate/u, both.stderr);
    assert.match(both.stderr, /npm run check -- --full/u, "the refusal names no way to run the gate");
    const words = run(work, ["--wait", "soon"]);
    assert.equal(words.status, 1, words.stdout + words.stderr);
    assert.match(words.stderr, /--wait takes the minutes to wait for a verdict, not `soon`/u, words.stderr);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
