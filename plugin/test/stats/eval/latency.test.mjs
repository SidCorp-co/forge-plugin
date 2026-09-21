/* The per-class latency comparison: the arithmetic on profiles built by hand, so every figure is one
   a case can count, and the wiring on the fixture corpus the other eval cases read. */
import assert from "node:assert/strict";
import test from "node:test";

import { CALLS, MOVED, classesCompared, latencyLines } from "../../../src/stats/eval/latency.mjs";
import { runsMark } from "../../../src/stats/eval/eval.mjs";
import { marksOf } from "../../../src/stats/marks/marks.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { PROJECT, ask, askStats, corpusOf } from "../fixture-eval.mjs";

const profile = ({ classes = [], reads = [], help = 0 }) => ({
  byClass: classes.map(([label, calls, wait]) => [label, { calls, wait }]),
  helpReads: reads.map(([label, calls]) => [label, { calls, runs: calls, again: 0 }]),
  help: { calls: help },
});

/* One verb whose calls clear the floor on both sides, one class only the recent window reached, one
   only the earlier one did. 25s a call falling to 10s is a shift of -0.6, past the bound. */
const NOW = profile({
  classes: [["forge record verdict", 100, 1000], ["gate", 10, 600]],
  reads: [["forge record verdict", 38]],
  help: 544,
});
const BEFORE = profile({
  classes: [["forge record verdict", 50, 1250], ["ship", 4, 400]],
  reads: [["forge record verdict", 30]],
  help: 430,
});

test("every class either window reached gets a row, and the window that reached none of it has no mean", () => {
  const { rows, why, lookups } = classesCompared(NOW, BEFORE);
  assert.equal(why, null);
  assert.deepEqual(lookups, { before: 430, now: 544 }, "the population sentence's own counts");
  assert.deepEqual(rows.map((one) => one.label), ["forge record verdict", "gate", "ship"],
    "one row per class in either window, by whichever side spent more on it");

  const [verdict, gate, ship] = rows;
  assert.deepEqual(
    { before: verdict.before.seconds, now: verdict.now.seconds, shift: verdict.shift },
    { before: 25, now: 10, shift: -0.6 },
    "seconds a call is the class's own wait over its own calls, on each side",
  );
  assert.deepEqual({ calls: gate.before.calls, seconds: gate.before.seconds }, { calls: 0, seconds: null },
    "a window holding no call of the class reads zero calls and no mean, never a mean of zero");
  assert.equal(gate.shift, null, "and nothing moved, there being no pair of means to move between");
  assert.equal(gate.toolMinutes, null);
  assert.deepEqual({ calls: ship.now.calls, seconds: ship.now.seconds }, { calls: 0, seconds: null },
    "and the same on the other side");
  assert.equal(ship.named, false, "neither is named, having no shift to judge");
});

test("the lookups inside a class's own denominator are carried on both sides", () => {
  const [verdict, gate] = classesCompared(NOW, BEFORE).rows;
  assert.deepEqual({ before: verdict.before.lookups, now: verdict.now.lookups }, { before: 30, now: 38 },
    "a denominator whose mixture moved is visible as that and not as a verb that got slower");
  assert.deepEqual({ before: gate.before.lookups, now: gate.now.lookups }, { before: 0, now: 0 },
    "a class no run read the help of reads nought rather than absent");
});

test("the movement a named class accounts for is tool-minutes at the recent window's own calls", () => {
  const [verdict] = classesCompared(NOW, BEFORE).rows;
  assert.equal(verdict.named, true, `-60% is past the bound of ${MOVED}`);
  assert.equal(verdict.toolMinutes, -25, "(10 - 25) seconds over 100 calls is 25 minutes of tool time");
  const lines = latencyLines({ classes: classesCompared(NOW, BEFORE) });
  assert.ok(lines.some((line) => /^ {2}forge record verdict {2}.*-60% a call, -25 tool-min over 100 call\(s\)$/u.test(line)),
    `the prose names the class, the move and the tool-minutes:\n${lines.join("\n")}`);
  assert.ok(lines.some((line) => line.includes("in the tool-minutes that move accounts for")),
    "and the heading says what kind of minute it is");
});

test("the bound is the reader's own constant, not a figure taken off the corpus around it", () => {
  assert.equal(classesCompared.length, 2,
    "the reader takes the two profiles and nothing a corpus-measured floor could arrive through");
  assert.deepEqual(classesCompared(NOW, BEFORE), classesCompared(NOW, BEFORE));
  const barely = profile({ classes: [["gate", 50, 50 * 14.9]] });
  const past = profile({ classes: [["gate", 50, 50 * 15.1]] });
  const was = profile({ classes: [["gate", 50, 50 * 10]] });
  assert.equal(classesCompared(barely, was).rows[0].named, false, "at the bound exactly, no naming");
  assert.equal(classesCompared(past, was).rows[0].named, true, "a hair past it, named");
});

test("a class thin on both sides is folded into one tail line and never named", () => {
  const thin = profile({ classes: [["forge attach", CALLS - 1, 190]] });
  const before = profile({ classes: [["forge attach", 2, 2]] });
  const { rows } = classesCompared(thin, before);
  assert.equal(rows[0].thin, true, `${CALLS - 1} and 2 calls are both under the floor of ${CALLS}`);
  assert.equal(rows[0].named, false, "so a tenfold move in its mean names nothing");
  const lines = latencyLines({ classes: classesCompared(thin, before) });
  assert.ok(lines.some((line) => line === `  1 class(es) with fewer than ${CALLS} call(s) on either side, listed under --json`),
    lines.join("\n"));
  assert.ok(lines.some((line) => line.includes("no class moved past ±50%, over the 0 with a mean on both sides")),
    lines.join("\n"));
  const fat = profile({ classes: [["forge attach", CALLS, 200]] });
  assert.equal(classesCompared(fat, before).rows[0].thin, false, "the floor is met by either side alone");
});

test("the screen states the population and caps the rows, and --json is where the rest are", () => {
  const many = (side) => profile({
    classes: Array.from({ length: 15 }, (_, n) => [`c${n}`, 30, 30 * (n + side)]),
    help: side * 10,
  });
  const held = classesCompared(many(2), many(1));
  const lines = latencyLines({ classes: held });
  assert.equal(held.rows.length, 15, "the reading holds every class");
  assert.equal(lines.filter((line) => /call\(s\) @/u.test(line)).length, 10, "the screen lists ten");
  assert.ok(lines.includes("  (5 more; --json for all)"), lines.join("\n"));
  assert.ok(lines[1].includes("over every call classed to it, the 10 → 20 help lookup(s) among them included"),
    `the population is named where the table opens:\n${lines[1]}`);
});

test("a before window that carries no class figures is said, and so is having none at all", () => {
  const none = latencyLines({ classes: classesCompared(NOW, null) });
  assert.deepEqual(none, ["", "seconds a call by class, before → now",
    "  there is no window before this one, so no class has a figure to compare with"]);
  const held = classesCompared(NOW, { helpReads: [], help: { calls: 0 } });
  assert.deepEqual(held.rows, []);
  assert.match(held.why, /^the reading standing as the before window carries no class figures/u);
});

test("the comparison reaches the screen and the reading, and asks the tracker for nothing", () => {
  const room = corpusOf(40);
  const screen = ask(room, "--size", "20", "--requests", "1");
  assert.equal(screen.status, 0, screen.stderr);
  assert.match(screen.stdout, /^seconds a call by class, before → now — over every call classed to it/mu);
  assert.match(screen.stdout,
    /^ {2}forge claim +20 call\(s\) @ +810\.0s → +20 call\(s\) @ +810\.0s +0% +lookups 0 → 0$/mu,
    screen.stdout);
  assert.match(screen.stdout, /^ {2}no class moved past ±50%, over the 1 with a mean on both sides$/mu);

  const json = JSON.parse(ask(room, "--size", "20", "--requests", "1", "--json").stdout);
  assert.deepEqual(json.classes, classesCompared(json.now.profile, json.before.profile),
    "the reading carries the comparison the screen was built from, off the two profiles and nothing else");
  assert.equal(json.classes.rows[0].label, "forge claim");

  const alone = ask(corpusOf(3), "--size", "5", "--requests", "1");
  assert.match(alone.stdout, /there is no window before this one, so no class has a figure to compare with/u,
    "a corpus with one window says why there is no comparison rather than comparing with nothing");
});

test("a before window short of a full one still carries the comparison, the shortfall said as it is", () => {
  const short = ask(corpusOf(28), "--size", "20", "--requests", "1");
  assert.equal(short.status, 0, short.stderr);
  assert.match(short.stdout, /^not a comparison: the window before it holds 8 of 20/mu);
  assert.match(short.stdout, /^seconds a call by class, before → now/mu, "and the table prints anyway");
});

/* The held reading's own window on the before side, and not the live corpus over that span: the
   angles recompute their side on purpose, and this table is the other kind — it reports what the two
   readings hold. */
test("an anchored comparison takes the held reading's window as the before side", () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-latency-home-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    assert.match(runsMark(PROJECT), /held as mark 50/u);
    const [record] = marksOf("runs");
    corpusOf(75, room);
    const held = JSON.parse(askStats(room, ["eval", "--checkout", PROJECT, "--against", "50",
      "--requests", "1", "--json"], home).stdout);
    assert.deepEqual(held.classes, classesCompared(held.now.profile, record.now.profile),
      "the stored window's own profile is the before side");
  } finally {
    process.env.XDG_CONFIG_HOME = was.XDG_CONFIG_HOME;
    if (was.TMPDIR === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = was.TMPDIR;
  }
});
