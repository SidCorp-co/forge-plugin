/* The per-class latency comparison: the arithmetic on profiles built by hand, so every figure is one
   a case can count, and the wiring on the fixture corpus the other eval cases read. */
import assert from "node:assert/strict";
import test from "node:test";

import { CALLS, MOVED, classesCompared, latencyLines } from "../../../src/stats/eval/latency.mjs";
import { MOVED_AT, POLL, TABLE, WAIT } from "../../../src/stats/corpus/classes.mjs";
import { runsMark } from "../../../src/stats/eval/eval.mjs";
import { marksOf } from "../../../src/stats/marks/marks.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { PROJECT, ask, askStats, corpusOf } from "../fixture-eval.mjs";

const profile = ({ classes = [], reads = [], help = 0, table, declares }) => ({
  ...(table === undefined ? {} : { table }),
  ...(declares === undefined ? {} : { declares }),
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
  assert.ok(lines.some((line) => line === "  1 class(es) folded, listed under --json"), lines.join("\n"));
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
  assert.ok(lines[1].endsWith(`A class under ${CALLS} call(s) on both sides is folded rather than listed or named`),
    `and so is the floor:\n${lines[1]}`);
  assert.equal(lines.filter((line) => line.includes("folded")).length, 1,
    "no class of this pair is under the floor, and the rule is stated once all the same");
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

/* A row's population belongs to the class table and not to the corpus, so a stored reading taken
   before a row moved and a live one taken after it hold two different denominators under one label.
   The rows the table left alone go on comparing (ISS-2086). */
const DECLARED = "gate=npm run check\nship=\ntest=\ncleanup=";
const GENERATIONS = (table, declares = DECLARED) => profile({
  table,
  declares,
  classes: [["read", 3000, 4000], [POLL, 200, 12_000], [WAIT, 160, 48_000], ["gate", 300, 19_000]],
});
const crossedIn = (held) => held.rows.filter((one) => one.crossed).map((one) => one.label);

test("two windows one table classed compare on every row, and name none as crossed", () => {
  const held = classesCompared(GENERATIONS(TABLE), GENERATIONS(TABLE));
  assert.deepEqual(held.crossedWhy, []);
  assert.deepEqual(crossedIn(held), [], "a sliding comparison classes both its windows by the running table");
  const lines = latencyLines({ classes: held });
  assert.ok(!lines.some((line) => line.includes("not comparable")), lines.join("\n"));
});

test("a stored reading taken at an earlier generation is crossed on the rows that moved and no others", () => {
  const held = classesCompared(GENERATIONS(TABLE), GENERATIONS(TABLE - 1));
  assert.deepEqual(new Set(crossedIn(held)), new Set([...MOVED_AT.keys()]),
    "every row whose population moved at this generation, which is what `MOVED_AT` names");
  const gate = held.rows.find((one) => one.label === "gate");
  assert.equal(gate.crossed, false, "a row the generation left alone is comparable across it");
  assert.equal(gate.shift, 0, "and goes on printing its move");
  for (const one of held.rows.filter((row) => row.crossed)) {
    assert.deepEqual({ shift: one.shift, minutes: one.toolMinutes, named: one.named },
      { shift: null, minutes: null, named: false },
      `${one.label} counts a different population on each side, so no move is read off it`);
  }
  const lines = latencyLines({ classes: held });
  const said = lines.find((line) => line.includes("not comparable"));
  assert.ok(said, lines.join("\n"));
  for (const label of MOVED_AT.keys()) assert.ok(said.includes(label), `${label} is named: ${said}`);
  assert.ok(said.includes(`classed by class table generation ${TABLE - 1}, against generation ${TABLE}`), said);
  assert.ok(said.includes("The other 1 row(s) stand"), said);
  assert.ok(lines.some((line) => line.includes("over the 1 with a mean on both sides")),
    "and a crossed row is outside the denominator of what moved");
});

test("a stored reading naming no generation is comparable on no row at all", () => {
  const held = classesCompared(GENERATIONS(TABLE), profile({ classes: [["read", 1, 1], ["gate", 1, 1]] }));
  assert.equal(crossedIn(held).length, held.rows.length,
    "the table that classed it is unreadable from here, so the rows it shares are shared by name only");
  const said = latencyLines({ classes: held }).find((line) => line.includes("not comparable"));
  assert.ok(said.includes("classed by a class table this reading cannot name"), said);
  assert.ok(said.endsWith("which is every row of this pair"), said);
});

test("a crossed row reaches the screen past the fold a thin row takes and past the listing's cap", () => {
  const thin = (side) => profile({
    table: side === 2 ? TABLE : TABLE - 1,
    classes: [["read", CALLS - 1, 19 * side], ...Array.from({ length: 15 }, (_, n) => [`c${n}`, 30, 30 * (n + side)])],
  });
  const lines = latencyLines({ classes: classesCompared(thin(2), thin(1)) });
  assert.equal(lines.filter((line) => /call\(s\) @/u.test(line)).length, 10, "the listing caps at ten rows");
  assert.ok(lines.some((line) => line.includes("class(es) folded")), "and folds the one thin on both sides");
  const said = lines.find((line) => line.includes("not comparable"));
  assert.ok(said.startsWith("read — not comparable"), `the folded crossed row is said anyway:\n${lines.join("\n")}`);
});

test("the reading carries what classed each window, in both halves", () => {
  const room = corpusOf(40);
  const json = JSON.parse(ask(room, "--size", "20", "--requests", "1", "--json").stdout);
  assert.equal(json.now.profile.table, TABLE, "a profile carries the generation of the table that classed it");
  assert.equal(typeof json.before.profile.declares, "string",
    "and the words the project declared for the rows its declaration arms");
  assert.deepEqual(json.classes.crossedWhy, [], "two windows of one corpus were classed the same way");
  assert.deepEqual(json.classes.rows.map((one) => one.crossed), json.classes.rows.map(() => false));
});

/* The other half of what classed a row: four of them are classed by the project's own words, so a
   redeclared gate is a different population under the same label with the table's generation
   standing still — read as a comparison it is a gate that got faster (ISS-2086). */
test("two readings taken under different declarations are crossed on the rows a declaration arms", () => {
  /* The gate's mean falls by two thirds across the pair, which is past the bound and not at it: a
     move exactly at the bound is named by nothing anyway, so a case built on one would pass however
     the reader behaved. The control below is the same two windows under one declaration, and it is
     there to prove the figure is nameable before the declaration is asked to suppress it. */
  const gateOf = (declares, wait) => profile({
    table: TABLE,
    declares,
    classes: [["read", 3000, 4000], [POLL, 200, 12_000], [WAIT, 160, 48_000], ["gate", 300, wait]],
  });
  const control = classesCompared(gateOf(DECLARED, 19_000), gateOf(DECLARED, 57_000));
  const named = control.rows.find((one) => one.label === "gate");
  assert.deepEqual({ before: named.before.seconds, now: named.now.seconds, named: named.named },
    { before: 190, now: 63.333333333333336, named: true },
    "190s a call falling to 63s is a move this reader names when one declaration counted both sides");
  assert.ok(latencyLines({ classes: control }).some((line) => /^ {2}gate {2}.*-67% a call, /u.test(line)),
    "and says so in the prose under the table");

  const held = classesCompared(gateOf(DECLARED, 19_000), gateOf("gate=make check\nship=\ntest=\ncleanup=", 57_000));
  assert.deepEqual(crossedIn(held), ["gate"], "the table's generation moved for nothing, and the gate row still did");
  assert.deepEqual(held.crossedWhy,
    ["counted by different words for the rows a project's own declaration arms"],
    "and the reason is the declaration rather than the generation");
  const gate = held.rows.find((one) => one.label === "gate");
  assert.deepEqual({ before: gate.before.seconds, now: gate.now.seconds }, { before: 190, now: 63.333333333333336 },
    "the same two means as the control, so what changed is only which words counted them");
  assert.deepEqual({ shift: gate.shift, minutes: gate.toolMinutes, named: gate.named },
    { shift: null, minutes: null, named: false }, "and none of it is read off a row counting two populations");
  const lines = latencyLines({ classes: held });
  assert.ok(lines.some((line) => /^gate — not comparable/u.test(line)), lines.join("\n"));
  assert.ok(!lines.some((line) => /^ {2}gate {2}.*a call, /u.test(line)),
    `the prose the control printed is gone:\n${lines.join("\n")}`);
  assert.ok(lines.some((line) => line.includes("over the 3 with a mean on both sides")),
    "and the crossed row is outside the denominator of what moved");
  for (const label of [...MOVED_AT.keys()]) {
    assert.equal(held.rows.find((one) => one.label === label).crossed, false,
      `${label} is this code's own row and no declaration reaches it`);
  }
});

/* Both halves at once: a stored reading from an earlier generation whose project also renamed its
   gate crosses that row for both reasons, and a reader told only one of them would put the other
   down to the change under test. */
test("a reading that crossed both halves says both", () => {
  const held = classesCompared(GENERATIONS(TABLE),
    GENERATIONS(TABLE - 1, "gate=make check\nship=\ntest=\ncleanup="));
  assert.deepEqual(new Set(crossedIn(held)), new Set([...MOVED_AT.keys(), "gate"]));
  assert.deepEqual(held.crossedWhy, [
    `classed by class table generation ${TABLE - 1}, against generation ${TABLE}`,
    "counted by different words for the rows a project's own declaration arms",
  ]);
  const said = latencyLines({ classes: held }).find((line) => line.includes("not comparable"));
  assert.ok(said.includes("and the two were counted by different words"), said);
});

test("a reading written before the declarations were carried is told from a project that declared nothing", () => {
  const bare = classesCompared(GENERATIONS(TABLE),
    profile({ table: TABLE, classes: [["read", 3000, 4000], ["gate", 300, 19_000]] }));
  assert.deepEqual(crossedIn(bare), ["gate"], "no words at all is not the same as no words declared");
  const none = classesCompared(GENERATIONS(TABLE, "gate=\nship=\ntest=\ncleanup="),
    GENERATIONS(TABLE, "gate=\nship=\ntest=\ncleanup="));
  assert.deepEqual(crossedIn(none), [], "while two readings that both declared nothing agree");
});
