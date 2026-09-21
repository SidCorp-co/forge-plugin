/* One angle per shipped surface, one case per rule: what each reads off a profile, what the floor is
   taken over, and which of the four dispositions each way of falling short earns. The corpus these
   run against is `fixture-eval.mjs`'s, small enough to count by hand. */
import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ANGLES, DISPOSITIONS, NOT_MEASURED, POSITIONS,
  angleOf, anglesAsked, anglesOver, anglesSaid, floorsOver,
} from "../../../src/stats/eval/angles.mjs";
import { profileOf } from "../../../src/stats/runs.mjs";
import { marksPath } from "../../../src/stats/marks/marks.mjs";
import { FLOOR, releaseMark } from "../../../src/stats/eval/eval.mjs";
import { refusing } from "../../../src/resolve/settings.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { PROJECT, ask, askStats, corpusOf, runsOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-angles-home-");

const NAMES = ["wall", "calls", "edit-chars", "guide-reread",
  "cache-read", "cache-read-per-request", "cache-create", "output"];
const SET = NAMES.join(", ");

/* A profile as `profileOf` returns one, cut to what the angles read. `billed` is the runs of it that
   hold a measured request, which is a population of its own and not `runs`. */
const profile = ({
  runs = 50, minutes = 60, calls = 200, chars = 1000, pairs = 10, again = 2,
  billed = 40, requests = 400, read = 1e6, written = 1e5, out = 1e4,
}) => ({
  runs,
  medianMinutes: minutes,
  medianCalls: calls,
  editCharsPerRun: chars,
  guideParts: pairs ? [["issue-flow verification (flow)", { calls: pairs + again, runs: pairs, again }]] : [],
  tokens: {
    runs: billed,
    requests,
    perRun: billed ? { cacheRead: read, cacheCreate: written, output: out } : {},
    perRequest: requests ? { cacheRead: read / 10 } : {},
  },
});

const window = (over) => ({ runs: over.runs ?? 50, profile: profile(over) });

/* A floor wide enough to pass the POSITIONS minimum, with the quantiles a case wants. */
const floorOf = (p95, shifts = Array.from({ length: POSITIONS }, () => p95)) =>
  ({ before: 50, now: 50, over: shifts.length, dropped: 0, median: p95, p90: p95, p95, shifts });

const judge = (before, now, floor = floorOf(0.05)) =>
  angleOf("wall", { before: window(before), now: window(now) }, floor, FLOOR);

test("each angle takes its figure and counts its own population off one profile", () => {
  const held = profile({
    minutes: 61.5, calls: 180, chars: 40_000, pairs: 100, again: 4,
    billed: 48, requests: 9600, read: 29_600_000, written: 871_000, out: 25_900,
  });
  assert.deepEqual(NAMES.map((name) => ANGLES[name].of(held)),
    [61.5, 180, 40_000, 0.04, 29_600_000, 2_960_000, 871_000, 25_900]);
  assert.deepEqual(NAMES.map((name) => ANGLES[name].countOf(held)), [50, 50, 50, 100, 48, 9600, 48, 48],
    "four populations: the window's runs, the pairs its runs read, the runs the API billed, and their requests");
  assert.equal(ANGLES["guide-reread"].of(profile({ pairs: 0 })), null,
    "a population of nothing carries no figure, which is not a figure of nought");
  assert.equal(ANGLES.wall.of({ runs: 3 }), null, "a profile that never held the figure carries none either");
});

test("the floor is the relative shift of two adjacent blocks, over the positions that yielded one", () => {
  /* Blocks of one run each, so a block's figure is the value written here. Positions run while
     at + 1 + 1 <= 6: five of them, pairing 10-20, 20-30, 30-40, 40-50, 50-10. */
  const blocks = [10, 20, 30, 40, 50, 10].map((minutes) => profile({ runs: 1, minutes }));
  const floor = floorsOver(blocks, blocks, 1, 1, 6, ["wall"]).get("wall");
  assert.deepEqual(floor.shifts.map((one) => Math.round(one * 1000) / 1000), [0.25, 0.333, 0.5, 0.8, 1],
    "|now - before| / before, smallest first");
  assert.equal(floor.over, 5);
  assert.equal(floor.dropped, 0);
  assert.deepEqual([floor.median, floor.p90, floor.p95], [0.5, 1, 1],
    "the value at 50%, 90% and 95% of five shifts, by index and never by interpolation");
  assert.deepEqual([floor.before, floor.now], [1, 1], "the floor names the two sizes it was taken at");
});

test("a position whose figure is zero or absent yields no shift, and the quantiles are over the rest", () => {
  const blocks = [10, 0, 30, 40, 50, 10].map((minutes) => profile({ runs: 1, minutes }));
  const zeroed = floorsOver(blocks, blocks, 1, 1, 6, ["wall"]).get("wall");
  assert.deepEqual(zeroed.shifts.map((one) => Math.round(one * 1000) / 1000), [0.25, 0.333, 0.8, 1],
    "the position whose before figure is zero yielded none; the one that fell to zero moved by all of it");
  assert.deepEqual([zeroed.over, zeroed.dropped], [4, 1]);
  const empty = [10, 20, 30, 40, 50, 10].map((minutes) => profile({ runs: 1, minutes, pairs: 0 }));
  const absent = floorsOver(empty, empty, 1, 1, 6, ["guide-reread"]).get("guide-reread");
  assert.deepEqual([absent.over, absent.dropped, absent.median], [0, 5, null],
    "a population of nothing on either side yields no shift, and no positions is no quantile");
});

test("a shift past the floor reads improved or declined by the angle's own direction", () => {
  const fell = judge({ minutes: 100 }, { minutes: 50 });
  assert.equal(fell.disposition, DISPOSITIONS.improved, "wall is lower-is-better, so a fall improved");
  assert.equal(fell.shift, -0.5);
  assert.equal(fell.past, 0, "no position of that floor moved as far");
  const rose = judge({ minutes: 50 }, { minutes: 100 });
  assert.equal(rose.disposition, DISPOSITIONS.declined);
  assert.equal(rose.better, "lower");
  assert.equal(NAMES.every((name) => ANGLES[name].better === -1), true, "every shipped angle is lower-is-better");
});

test("a shift no further than the floor's p95 is not distinguishable from this corpus's own adjacent windows", () => {
  const inside = judge({ minutes: 100 }, { minutes: 96 });
  assert.equal(inside.disposition, DISPOSITIONS.same);
  assert.equal(inside.past, 1, "and every position of that floor moved at least as far");
  const at = judge({ minutes: 100 }, { minutes: 105 });
  assert.equal(at.disposition, DISPOSITIONS.same, "the p95 itself is inside the floor, not past it");
  const zeroes = angleOf("edit-chars", { before: window({ chars: 0 }), now: window({ chars: 0 }) },
    floorOf(0.05), FLOOR);
  assert.equal(zeroes.disposition, DISPOSITIONS.same, "two figures that never left zero did not move");
  assert.deepEqual([zeroes.shift, zeroes.why], [0, "neither window's figure left zero"]);
});

test("two figures that both read zero are still a verdict, and a floor too thin supports none", () => {
  const thin = angleOf("edit-chars", { before: window({ runs: 3, chars: 0 }), now: window({ runs: 3, chars: 0 }) },
    { before: 3, now: 3, over: 0, dropped: 40, median: null, p90: null, p95: null, shifts: [] }, FLOOR);
  assert.equal(thin.disposition, DISPOSITIONS.unevaluable,
    "the floor is asked before the both-zero reading, never after it");
  assert.match(thin.why, new RegExp(`^0 adjacent position\\(s\\) of this corpus yielded a shift at 3 against 3, `
    + `fewer than the ${POSITIONS} a p95 needs$`, "u"));
});

test("a percentile in the tail is the nearest rank, so twenty positions is where a p95 stops being the largest", () => {
  /* Twenty-one blocks of one run, each a step of 1% more than the last than the one before it, so
     the twenty positions yield the twenty shifts 1% through 20% and no two are equal. */
  const values = [100];
  for (let at = 0; at < POSITIONS; at += 1) values.push(values[at] * (1 + (at + 1) / 100));
  const blocks = values.map((minutes) => profile({ runs: 1, minutes }));
  const floor = floorsOver(blocks, blocks, 1, 1, values.length, ["wall"]).get("wall");
  assert.equal(floor.over, POSITIONS);
  assert.deepEqual(floor.shifts.map((one) => Math.round(one * 100)), Array.from({ length: POSITIONS }, (u, at) => at + 1));
  assert.equal(Math.round(floor.p95 * 100), 19, "the nineteenth of twenty, never the twentieth");
  assert.equal(Math.round(floor.p90 * 100), 18);
  assert.equal(Math.round(floor.median * 1000) / 1000, Math.round(((0.1 + 0.11) / 2) * 1000) / 1000,
    "and the middle is the one home's, which means the mean of the two middle values");
  const between = angleOf("wall", { before: window({ minutes: 100 }), now: window({ minutes: 119.5 }) }, floor, FLOOR);
  assert.equal(between.disposition, DISPOSITIONS.declined,
    "a shift between the nineteenth and the twentieth observation is past the p95");
});

test("a thin window, a figure a window does not carry and a before figure of zero are each not evaluable", () => {
  const thin = angleOf("wall", { before: window({ runs: 2 }), now: window({}) }, floorOf(0.05), FLOOR);
  assert.equal(thin.disposition, DISPOSITIONS.unevaluable);
  assert.match(thin.why, new RegExp(`the before window holds 2 run\\(s\\), fewer than the floor of ${FLOOR}`, "u"));
  const now = angleOf("wall", { before: window({}), now: window({ runs: 1 }) }, floorOf(0.05), FLOOR);
  assert.match(now.why, new RegExp(`this window holds 1 run\\(s\\), fewer than the floor of ${FLOOR}`, "u"));
  const none = angleOf("guide-reread", { before: window({ pairs: 0 }), now: window({}) }, floorOf(0.05), FLOOR);
  assert.match(none.why, /the before window carries no value for this figure, over 0 run-and-part pair/u);
  const zero = judge({ minutes: 0 }, { minutes: 10 });
  assert.equal(zero.disposition, DISPOSITIONS.unevaluable);
  assert.match(zero.why, /the before figure is zero, so there is no relative shift to take/u);
  assert.deepEqual([zero.shift, zero.past], [null, null], "a verdict withheld reports no shift either");
});

test("a floor under the positions a p95 needs withholds the verdict and says how many it had", () => {
  const short = judge({ minutes: 100 }, { minutes: 50 }, floorOf(0.05, Array(POSITIONS - 1).fill(0.05)));
  assert.equal(short.disposition, DISPOSITIONS.unevaluable);
  assert.match(short.why, new RegExp(`${POSITIONS - 1} adjacent position\\(s\\) of this corpus yielded a shift `
    + `at 50 against 50, fewer than the ${POSITIONS} a p95 needs`, "u"));
  assert.equal(judge({ minutes: 100 }, { minutes: 50 }, null).disposition, DISPOSITIONS.unevaluable);
  assert.equal(angleOf("wall", { before: null, now: window({}) }, null, FLOOR).why,
    "there is no window before this one");
});

test("every verdict is one of the four, and the floor's own working never leaves the reading", () => {
  const readings = [judge({ minutes: 100 }, { minutes: 50 }), judge({ minutes: 100 }, { minutes: 99 }),
    judge({ minutes: 50 }, { minutes: 100 }), judge({ minutes: 0 }, { minutes: 1 })];
  assert.deepEqual(readings.map((one) => one.disposition),
    [DISPOSITIONS.improved, DISPOSITIONS.same, DISPOSITIONS.declined, DISPOSITIONS.unevaluable]);
  assert.equal(Object.keys(DISPOSITIONS).length, 4);
  assert.equal(readings[0].floor.shifts, undefined, "the shifts are the floor's working, not its reading");
  assert.deepEqual(Object.keys(readings[0].floor), ["before", "now", "over", "dropped", "median", "p90", "p95"]);
});

test("a held reading's side is recomputed from this corpus, and its stored profile answers for nothing", () => {
  const rows = runsOf(6);
  const held = {
    against: 100,
    now: { runs: 1, profile: profile({ runs: 1 }) },
    before: { runs: 9, profile: { ...profile({ minutes: 999, runs: 9 }), from: rows[0].startedAt, to: rows[1].endedAt } },
  };
  const [one] = anglesOver({ ordered: rows, held, names: ["wall"], runFloor: FLOOR });
  assert.deepEqual(one.recomputed, { held: 9, found: 2 },
    "the two runs of that span this corpus still holds, against the nine the reading recorded");
  assert.equal(one.before.runs, 2, "and the before side is those two, never the stored profile's nine");
  assert.notEqual(one.before.figure, 999, "the stored figure answers for nothing");
  assert.equal(one.disposition, DISPOSITIONS.unevaluable);
  assert.match(one.why, /the before window holds 2 run\(s\)/u);
});

/* The window this recovers is bounded and not identified: a mark stores a span, never the runs that
   were in it. So what the span recovers is reported rather than assumed, and the bound it is read
   against has to be one every member of the window satisfies. */
test("a held window whose runs overlap recovers all of them, the span being bounded by every run and not by the first", () => {
  const spans = [[10, 20], [0, 30], [25, 40]];
  const rows = spans.map(([startedAt, endedAt], at) => ({
    ...runsOf(3)[at], startedAt, endedAt, seconds: (endedAt - startedAt) / 1000,
  })).sort((left, right) => left.endedAt - right.endedAt);
  const stored = profileOf(rows);
  assert.deepEqual([stored.from, stored.to], [0, 40],
    "the earliest start and the latest end, whichever order the window was handed over in");
  const held = { against: 100, now: { runs: 3, profile: profile({ runs: 3 }) }, before: { runs: 3, profile: stored } };
  const [one] = anglesOver({ ordered: rows, held, names: ["wall"], runFloor: FLOOR });
  assert.deepEqual(one.recomputed, { held: 3, found: 3 }, "the run that began first and ended second is a member");
  assert.equal(one.before.figure, stored.medianMinutes, "and the recomputed side is the window the mark held");
});

test("--angles names which angles to read, in the order asked, and refuses a name the set does not hold", async () => {
  assert.deepEqual(anglesAsked(undefined), NAMES, "naming none asks for every one of them");
  assert.deepEqual(anglesAsked("calls,wall"), ["calls", "wall"], "and the order asked is the order read");
  /* `fail` ends the process outside `refusing`, which is where the verb calls it from. */
  const refused = (raw) => assert.rejects(refusing(async () => anglesAsked(raw)));
  await refused("nope");
  await assert.rejects(refusing(async () => anglesAsked("nope")),
    new RegExp(`no angle named nope\\. There is: ${SET}\\.`, "u"));
  await assert.rejects(refusing(async () => anglesAsked("wall,wall")),
    /--angles names wall twice, and an angle is read once\. Ask for each once: `--angles wall`\./u);
  await assert.rejects(refusing(async () => anglesAsked(",")), /--angles was given no angle name\. There is: wall/u);
});

test("the screen prints a block per angle, each naming the population both its sides were taken over", () => {
  const printed = anglesSaid([judge({ minutes: 100 }, { minutes: 50 })]).join("\n");
  assert.match(printed, /^wall\s+median minutes a run took end to end — lower is better$/mu);
  assert.match(printed, /^ {2}before\s+100 over 50 run\(s\) in the window$/mu);
  assert.match(printed, /^ {2}now\s+50 over 50 run\(s\) in the window$/mu);
  assert.match(printed, /^ {2}floor\s+5\.0% at the median, 5\.0% at p90, 5\.0% at p95, over 20 adjacent position\(s\) that yielded a shift and 0 that yielded none$/mu);
  assert.match(printed, /^ {2}moved\s+-50\.0%, and 0\.0% of those positions moved at least as far$/mu);
  assert.match(printed, /^ {2}verdict\s+improved$/mu);
});

test("the eval prints the angle blocks below its window figures, and --angles cuts them to what was asked", () => {
  const room = corpusOf(30);
  const whole = ask(room, "--size", "3");
  assert.equal(whole.status, 0, whole.stderr);
  for (const name of NAMES) assert.match(whole.stdout, new RegExp(`^${name}\\s+\\S`, "mu"), `${name} has a block`);
  assert.equal(whole.stdout.indexOf("\nwall ") > whole.stdout.indexOf("  before "), true,
    "the blocks sit below the window figures they judge");
  const two = ask(room, "--size", "3", "--angles", "calls,wall");
  assert.equal(two.status, 0, two.stderr);
  assert.match(two.stdout, /\ncalls\s+median tool calls[\s\S]*\nwall\s+median minutes/u, "in the order asked");
  for (const name of NAMES.filter((one) => one !== "calls" && one !== "wall")) {
    assert.doesNotMatch(two.stdout, new RegExp(`^${name}\\s+\\S`, "mu"), `${name} was not asked for`);
  }
});

test("an angle name this CLI does not hold is refused with the set, before a transcript is opened", () => {
  const refused = askStats(tempRoom("stats-angles-none-"), ["eval", "--checkout", PROJECT, "--angles", "nope"]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, new RegExp(`no angle named nope\\. There is: ${SET}\\.`, "u"));
  assert.equal(refused.stdout, "", "and nothing was read to say so");
});

test("--json carries an angle per name with its two figures, its population, its floor and its verdict", () => {
  const read = ask(corpusOf(30), "--size", "3", "--json");
  assert.equal(read.status, 0, read.stderr);
  const held = JSON.parse(read.stdout);
  assert.deepEqual(held.angles.map((one) => one.name), NAMES);
  const wall = held.angles[0];
  assert.deepEqual(Object.keys(wall).sort(),
    ["asks", "before", "better", "disposition", "floor", "name", "now", "over", "past", "recomputed", "shift", "why"]);
  assert.equal(Object.values(DISPOSITIONS).includes(wall.disposition), true);
  assert.equal(typeof wall.before.over, "number");
  assert.equal(wall.over, "run(s) in the window");
});

test("a mark holds the keys it held before an angle existed, and its write spends no floor", async () => {
  /* The observation is of the write releaseMark actually makes and never of the source text beside
     it: a second regex over a file proves the same nothing the first one did (ISS-2012). Angles are
     computed for real, over this exact corpus, before releaseMark ever runs, so the verdicts below
     are the corpus's own and not a stub — and the write that follows is checked for their trace. */
  const room = corpusOf(9);
  const ship = askStats(room, ["eval", "--checkout", PROJECT, "--size", "3", "--json"]);
  assert.equal(ship.status, 0, ship.stderr);
  const read = JSON.parse(ship.stdout);
  assert.equal(Object.hasOwn(read, "angles"), true, "the reading carries them");
  assert.equal(read.angles.length, Object.keys(ANGLES).length,
    "every shipped angle was computed, for real, over this corpus, before the write below runs");
  const seen = [...new Set(read.angles.map((one) => one.disposition))];

  /* Reachability, proven by making every angle- and floor-computing export radioactive rather than
     by reading a regex over the source: a copy of this tree's own `angles.mjs` is patched so
     `angleOf`, `anglesOver` and `floorsOver` — the verdict, the population that judges a shift, and
     the floor itself — all throw the moment any of them runs, and `releaseMark` is called against
     that copy. Each direct call below going up in flames is the proof the poison is live;
     `releaseMark` finishing clean over the same corpus, through the same copy, is the proof it
     never reaches any of the three, a discarded result included since the poison fires on entry. */
  const POISONED = [
    ["angleOf", "export const angleOf = (name, windows, floor, runFloor, recomputed = null) => {"],
    ["anglesOver", "export const anglesOver = ({ ordered, held, names, runFloor }) => {"],
    ["floorsOver", "export const floorsOver = (befores, nows, beforeSize, nowSize, total, names = NAMES) => {"],
  ];
  const pluginRoot = tempRoom("stats-angles-poison-");
  cpSync(new URL("../../../src", import.meta.url), join(pluginRoot, "src"), { recursive: true });
  cpSync(new URL("../../../hooks/vendor", import.meta.url), join(pluginRoot, "hooks", "vendor"), { recursive: true });
  const poisonRoot = join(pluginRoot, "src");
  const anglesFile = join(poisonRoot, "stats", "eval", "angles.mjs");
  const original = readFileSync(anglesFile, "utf8");
  const patched = POISONED.reduce((text, [, declared]) =>
    text.replace(declared, declared.replace("export const", "export let")), original);
  assert.notEqual(patched, original, "no declaration was left un-patched");
  const poisoned = `${patched}\n${POISONED.map(([name]) =>
    `${name} = () => { throw new Error("ISS-2012 poison: ${name} reached"); };`).join("\n")}\n`;
  writeFileSync(anglesFile, poisoned);
  const poisonedAngles = await import(pathToFileURL(anglesFile));
  for (const [name] of POISONED) {
    assert.throws(() => poisonedAngles[name](), new RegExp(`ISS-2012 poison: ${name} reached`, "u"),
      `the poison on ${name} is live`);
  }
  const { releaseMark: poisonedReleaseMark } = await import(pathToFileURL(join(poisonRoot, "stats", "eval", "eval.mjs")));

  const was = process.env.TMPDIR;
  let poisonedSaid;
  let realSaid;
  try {
    process.env.TMPDIR = room;
    poisonedSaid = await poisonedReleaseMark(PROJECT, { version: "0.0.0-iss2012-poisoned", head: "deadbeef" }, 3);
    /* The real, unpoisoned `releaseMark` this file already imports, called separately: reachability
       above proves execution never reaches the poison; this proves the record the production
       function actually writes — never the poisoned copy's own — carries no trace of the angles
       computed for real above. Neither call stands in for the other. */
    realSaid = await releaseMark(PROJECT, { version: "0.0.0-iss2012-real", head: "deadbeef" }, 3);
  } finally {
    process.env.TMPDIR = was;
  }
  assert.match(poisonedSaid, /held as 0\.0\.0-iss2012-poisoned/u,
    "releaseMark never touched the poisoned angleOf, anglesOver or floorsOver");
  assert.match(realSaid, /held as 0\.0\.0-iss2012-real/u);
  const stored = readFileSync(marksPath(), "utf8").trim().split("\n").map((line) => JSON.parse(line));
  for (const one of stored) {
    assert.equal(Object.hasOwn(one, "angles"), false, "and a stored reading carries none");
    assert.equal(Object.hasOwn(one, "floor"), false);
    assert.equal(Object.hasOwn(one, "notMeasured"), false,
      "nor the statement beside them: it is the screen's and `--json`'s, not a field of every mark a ship writes");
  }
  const written = stored.find((one) => one.version === "0.0.0-iss2012-real");
  const blob = JSON.stringify(written);
  for (const disposition of seen) {
    assert.doesNotMatch(blob, new RegExp(disposition.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
      "the write the real releaseMark actually made, right after this corpus's own angles were computed for real, carries none of their verdicts");
  }
});

/* The words themselves and not the constant: a case comparing a reading with `DISPOSITIONS.same`
   passes whatever that constant happens to say, which is how a disposition asserting a control the
   floor is not survived the consult that withdrew the reading (ISS-1994). */
test("the same verdict names the reference the floor is, and no disposition claims a control", () => {
  assert.equal(DISPOSITIONS.same,
    "not distinguishable from how far this corpus's own adjacent windows differ anyway");
  const said = anglesSaid([judge({ minutes: 100 }, { minutes: 99 })]).join("\n");
  assert.match(said, new RegExp(`^ {2}verdict\\s+${DISPOSITIONS.same}: no further than the floor's p95$`, "mu"));
  for (const text of Object.values(DISPOSITIONS)) {
    assert.doesNotMatch(text, /compared with itself|unchanged harness|against a null/u);
  }
});

/* The sentence claims every angle is a price and a sentence cannot check itself. This is what goes
   red the day an angle is added that reads higher as better, so the claim is revisited rather than
   left printing over a set it no longer covers (ISS-1996). */
test("every shipped angle reads lower as better, which is what the reading claims beside the verdicts", () => {
  assert.deepEqual(Object.entries(ANGLES).filter(([, one]) => one.better !== -1).map(([name]) => name), [],
    "the statement beside the verdicts says every angle is a price; one that is not makes it wrong");
  assert.match(NOT_MEASURED, new RegExp(`^what none of the ${NAMES.length} angles this verb holds measures: `, "u"));
});

/* The reading it exists for is the one where nothing looks wrong: eight green rows and no figure
   among them that read what any run produced. */
test("a reading where every angle improved says what it does not measure, on the screen and in --json", () => {
  const improved = NAMES.map(() => judge({ minutes: 100 }, { minutes: 50 }));
  assert.deepEqual([...new Set(improved.map((one) => one.disposition))], [DISPOSITIONS.improved]);
  assert.equal(anglesSaid(improved).includes(NOT_MEASURED), true, "beside the verdicts, not in a topic");
  assert.equal(anglesSaid([improved[0]]).includes(NOT_MEASURED), true,
    "and a single asked-for angle carries it too, the claim being about what the verb measures at all");

  const read = ask(corpusOf(30), "--size", "3", "--json");
  assert.equal(read.status, 0, read.stderr);
  assert.equal(JSON.parse(read.stdout).notMeasured, NOT_MEASURED,
    "a consumer reading only the machine form is told what the screen says");
  const screen = ask(corpusOf(30), "--size", "3", "--angles", "wall");
  assert.equal(screen.status, 0, screen.stderr);
  assert.equal(screen.stdout.includes(NOT_MEASURED), true);
});

test("a release anchor prints the same blocks, over the runs this corpus still holds of the held span", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-angles-release-");
  const room = corpusOf(12);
  try {
    process.env.XDG_CONFIG_HOME = home;
    process.env.TMPDIR = room;
    assert.match(await releaseMark(PROJECT, { version: "3.35.300", head: "abc1234" }, 3), /held as 3\.35\.300/u);
  } finally {
    Object.assign(process.env, was);
  }
  corpusOf(24, room);
  const since = askStats(room, ["eval", "--checkout", PROJECT, "--size", "3", "--since-release", "3.35.300"], home);
  assert.equal(since.status, 0, since.stderr);
  assert.match(since.stdout, /^wall\s+median minutes a run took end to end/mu, "the blocks print under a release anchor");
  assert.match(since.stdout,
    /^ {2}held\s+the held reading recorded 3 run\(s\); this corpus still holds 3 of that span,/mu,
    "and the held side is recomputed here rather than read off the stored profile");
  assert.match(since.stdout, /^ {2}verdict\s+(improved|declined|not distinguishable|not evaluable)/mu);
});

test("the eval's own help names --angles and every angle it holds", () => {
  const help = askStats(tempRoom("stats-angles-help-"), ["eval", "-h"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--angles a,a/u);
  for (const name of NAMES) assert.match(help.stdout, new RegExp(`\\b${name}\\b`, "u"), `${name} is named`);
});

test("a price is read off the profile's own token block, over the runs and the requests the API billed", () => {
  const held = profile({ runs: 50, billed: 44, requests: 8800, read: 27_200_000 });
  const prices = ["cache-read", "cache-read-per-request", "cache-create", "output"];
  assert.deepEqual(prices.map((name) => ANGLES[name].countOf(held)), [44, 8800, 44, 44],
    "never the window's 50 runs: a run the API billed nothing for is in neither figure");
  assert.deepEqual(prices.map((name) => ANGLES[name].over), [
    "run(s) in the window holding a measured request",
    "measured request(s) those runs made",
    "run(s) in the window holding a measured request",
    "run(s) in the window holding a measured request",
  ], "and each says which of the two it was taken over");
  assert.equal(ANGLES["cache-read"].of(held), 27_200_000);
  assert.equal(ANGLES["cache-read-per-request"].of(held), 2_720_000, "the ratio of sums, not the median");
});

test("a window holding no measured request is not evaluable, and says over what", () => {
  const empty = { runs: 50, profile: profile({ billed: 0, requests: 0 }) };
  const one = angleOf("cache-read", { before: empty, now: empty }, floorOf(0.05), FLOOR);
  assert.equal(one.disposition, DISPOSITIONS.unevaluable, "no population carries a figure, which is not a figure of nought");
  assert.equal(one.why, "the before window carries no value for this figure, over 0 run(s) in the window holding a measured request");
  assert.deepEqual([one.shift, one.before.figure], [null, null]);
  const said = anglesSaid([one]).join("\n");
  assert.match(said, /^ {2}before\s+unavailable over 0 run\(s\) in the window holding a measured request$/mu);
});

test("a price is asked for by name, and the block that prints is that one", () => {
  const read = ask(corpusOf(30), "--size", "3", "--angles", "cache-read-per-request");
  assert.equal(read.status, 0, read.stderr);
  assert.match(read.stdout, /^cache-read-per-request tokens an API request read back from the prompt cache/mu);
  for (const name of NAMES.filter((one) => one !== "cache-read-per-request")) {
    assert.doesNotMatch(read.stdout, new RegExp(`^${name}\\s+\\S`, "mu"), `${name} was not asked for`);
  }
});
