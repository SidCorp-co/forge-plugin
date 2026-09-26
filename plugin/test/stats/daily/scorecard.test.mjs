/* The scorecard's table and its arithmetic: what each metric declares, how a day's value, its
   baseline and its verdict are read off the corpora, and which tile a figure of the page's reading
   feeds. Runs are the `stats runs` fixture moved onto chosen days, whose friction is
   one refusal, one command typed three times and one long wait over sixteen calls. */
import assert from "node:assert/strict";
import test from "node:test";

import { METRICS, changeSaid, moveSaid, scorecardLines, scorecardOf, tileFedBy, verdictOf } from "../../../src/stats/daily/scorecard.mjs";
import { REOPENED, SPLIT } from "../../../src/stats/daily/tracker/closed.mjs";
import { runFrom } from "../../../src/stats/runs.mjs";
import { consult, runOn } from "./fixture-daily.mjs";

/* The fixture's calls sit between 00:00 and 00:42 UTC, so its days are UTC's. */
process.env.TZ = "UTC";

const DAY = "2026-09-20";

const runsOn = (day, many = 1) => Array.from({ length: many }, (_, index) => runFrom(`/r/${day}-${index}`, `s-${day}-${index}`, runOn(day)));

const readingOf = ({ runs = [], entries = [] } = {}) => ({ all: runs, entries, passes: [], hooks: [] });

const tileIn = (scorecard, id) => scorecard.find((one) => one.metric === id);

test("each metric declares its direction and its goal once, and every tile carries what its metric declared", () => {
  for (const metric of METRICS) {
    assert.ok(["lower", "higher"].includes(metric.better), metric.id);
    assert.match(metric.goal, /^G-\d{2}$/u, metric.id);
    assert.equal(typeof metric.of === "function", !metric.missing, `${metric.id} is read, or names the reader it waits for, never both`);
    if (metric.missing) assert.match(metric.missing.issue, /^ISS-\d+$/u, metric.id);
  }
  const scorecard = scorecardOf(readingOf(), DAY);
  assert.deepEqual(scorecard.map((one) => [one.metric, one.better, one.goal]), METRICS.map((one) => [one.id, one.better, one.goal]));
});

test("wasted calls are the calls the opportunities ranking counts as paid, waits apart, over every call of the day's runs", () => {
  const tile = tileIn(scorecardOf(readingOf({ runs: runsOn(DAY, 2) }), DAY), "wasted");
  assert.equal(tile.value, 18.8, "one refusal and two typings past the first, of sixteen calls, per run; the wait is not counted");
  assert.equal(tile.detail, "6 of 32 call(s)");
});

test("the consults tile is the day's consults ending at their call budget, of those that recorded one", () => {
  const at = (hour) => `${DAY}T${hour}:00:00.000Z`;
  const entries = [consult(at("09")), consult(at("10"), { calls: 2 }), consult(at("11"), { calls: 3 }), consult(at("12"), { budget: undefined })];
  const tile = tileIn(scorecardOf(readingOf({ entries }), DAY), "atBudget");
  assert.equal(tile.value, 33.3, tile.detail);
  assert.equal(tile.detail, "1 of 3 consult(s) that recorded a budget");
});

test("a baseline is the median over the seven days before that hold a value, and the change is read against it", () => {
  const runs = [...runsOn("2026-09-15"), ...runsOn("2026-09-18"), ...runsOn(DAY)];
  const tile = tileIn(scorecardOf(readingOf({ runs }), DAY), "wasted");
  assert.deepEqual([tile.value, tile.baseline, tile.baselineDays, tile.change, tile.verdict], [18.8, 18.8, 2, 0, "steady"]);
  const none = tileIn(scorecardOf(readingOf({ runs: runsOn(DAY) }), DAY), "wasted");
  assert.deepEqual([none.baseline, none.baselineDays, none.change, none.verdict], [null, 0, null, null], "no day before holds a run");
  const idle = tileIn(scorecardOf(readingOf({ runs: runsOn("2026-09-18") }), DAY), "wasted");
  assert.deepEqual([idle.value, idle.change, idle.verdict], [null, null, null], "a day with no run has no value to judge");
});

test("the baseline is the median of the days before and not their mean or either end", () => {
  const at = (day, hour) => `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
  const consults = (day, atBudget, budgeted) => Array.from({ length: budgeted }, (_, index) =>
    consult(at(day, index + 1), index < atBudget ? {} : { calls: 1 }));
  const entries = [...consults("2026-09-14", 0, 1), ...consults("2026-09-16", 1, 3), ...consults("2026-09-18", 3, 3), ...consults(DAY, 1, 2)];
  const tile = tileIn(scorecardOf(readingOf({ entries }), DAY), "atBudget");
  assert.deepEqual([tile.value, tile.baseline, tile.baselineDays, tile.change, tile.verdict], [50, 33.3, 3, 16.7, "worse"],
    "0%, 33.3% and 100% before: the median is 33.3, where the mean is 44.4 and the ends 0 and 100");
});

test("a change reads better or worse by the metric's declared direction, steady at none, and nothing where it is absent", () => {
  assert.equal(verdictOf("lower", -2), "better");
  assert.equal(verdictOf("lower", 2), "worse");
  assert.equal(verdictOf("higher", 2), "better");
  assert.equal(verdictOf("higher", -2), "worse");
  assert.equal(verdictOf("lower", 0), "steady");
  assert.equal(verdictOf("higher", null), null);
  assert.equal(changeSaid(2.5, "%"), "+2.5 pt", "a share moves in points");
  assert.equal(changeSaid(-3, " min"), "-3 min");
});

/* A closed reading made by hand: each day's closes of project `proj`, or why the day was not read, and
   the runs paired with the issues they owned. */
const closedReading = (days, pairs = [], owners = { pairs }) => ({ ...readingOf(), closed: {
  days: Object.fromEntries(Object.entries(days).map(([day, held]) => [day, Array.isArray(held)
    ? { closes: held.map((issueId, index) => ({ slug: "proj", issueId, at: Date.parse(`${day}T1${index}:00:00Z`) })) } : held])),
  owners: { proj: owners }, history: new Map() } });

const minutesRun = (day, minutes, keys) => ({ path: `/${day}-${minutes}`, startedAt: Date.parse(`${day}T01:00:00Z`), seconds: minutes * 60, issues: keys });

test("12. the closed count and its minutes each take a baseline over the days before that were read, and a verdict by direction", () => {
  const scorecard = scorecardOf(closedReading({ "2026-09-14": ["a"], "2026-09-15": ["b", "c", "d"], "2026-09-16": { unread: "proj: 503" },
    [DAY]: ["e", "f", "g"] }), DAY);
  const closed = tileIn(scorecard, "closed");
  assert.deepEqual([closed.value, closed.baseline, closed.baselineDays, closed.change, closed.verdict], [3, 2, 2, 1, "better"],
    "1 and 3 before, the unread day left out: more closed is better");
  assert.equal(closed.detail, REOPENED, "4. the count says a second close counts on its own day");
  const run = minutesRun("2026-09-15", 60, ["b"]);
  const minutes = tileIn(scorecardOf(closedReading({ "2026-09-15": ["b"], [DAY]: ["e"] }, [{ run, key: "b" }, { run: minutesRun(DAY, 90, ["e"]), key: "e" }]), DAY),
    "minutesPerClosed");
  assert.deepEqual([minutes.value, minutes.baseline, minutes.change, minutes.verdict], [90, 60, 30, "worse"], "more minutes a close is worse");
});

test("9, 10. the minutes tile states the minutes, the closes without a run and the equal-share split", () => {
  const run = minutesRun(DAY, 60, ["a", "b"]);
  const tile = tileIn(scorecardOf(closedReading({ [DAY]: ["a", "z"] }, [{ run, key: "a" }, { run, key: "b" }]), DAY), "minutesPerClosed");
  assert.equal(tile.value, 15, "half of 60 lent to a, over two closed issues");
  assert.equal(tile.detail, `30 min over 2 closed issue(s), 1 with no run on this device; ${SPLIT}`);
});

test("22. a day on which nothing closed has no minutes a close, and says none closed", () => {
  const tile = tileIn(scorecardOf(closedReading({ [DAY]: [] }), DAY), "minutesPerClosed");
  assert.deepEqual([tile.value, tile.unread], [null, null]);
  assert.equal(moveSaid(tile), "none on this day, no issue closed");
  assert.equal(tileIn(scorecardOf(closedReading({ [DAY]: [] }), DAY), "closed").value, 0, "a count read whole may be nought");
});

test("11, 16. minutes not read leave the count standing, and the terminal prints a tile not read with its reason", () => {
  const scorecard = scorecardOf(closedReading({ [DAY]: ["a"] }, [], { unread: "proj: its issue list came back short" }), DAY);
  assert.equal(tileIn(scorecard, "closed").value, 1);
  assert.deepEqual([tileIn(scorecard, "minutesPerClosed").value, tileIn(scorecard, "minutesPerClosed").unread], [null, "proj: its issue list came back short"]);
  const [line] = scorecardLines(scorecard).filter((one) => one.includes("agent minutes per closed issue"));
  assert.equal(line, "  agent minutes per closed issue: not read: proj: its issue list came back short (lower is better, G-11)");
});

test("a metric no reader computes is a tile with no figure, naming the issue that owes its reader", () => {
  const scorecard = scorecardOf(readingOf({ runs: runsOn(DAY) }), DAY);
  for (const [id, issue] of [["firstGate", "ISS-2425"]]) {
    const tile = tileIn(scorecard, id);
    assert.equal(tile.missing.issue, issue, id);
    assert.deepEqual([tile.value, tile.baseline, tile.change, tile.verdict], [null, null, null, null], id);
  }
});

test("a figure feeds a tile only where the tile's value is made of it, and a tile no reader computes is fed by none", () => {
  const content = { opportunities: { listed: [{ kind: "refusal" }, { kind: "wait" }] } };
  const fed = (key) => tileFedBy(key, content)?.id ?? null;
  assert.equal(fed("friction.headline.refusals"), "wasted");
  assert.equal(fed("opportunities.listed[#1].calls"), "wasted");
  assert.equal(fed("opportunities.listed[#2].calls"), null, "a wait is a call that ran, which the tile leaves out");
  assert.equal(fed("opportunities.listed[#1].runs"), null);
  assert.equal(fed("consults.headline.atBudget"), "atBudget");
  assert.equal(fed("consults.headline.answered"), null);
  for (const key of ["runs.headline.day.medianMinutes", "moved.phases.rose.now", "releases.landed[3.36.343].after.medianMinutes", "landings.headline.passes"]) {
    assert.equal(fed(key), null, `${key} feeds no computed tile, so a decision citing it points at its section`);
  }
  for (const metric of METRICS.filter((one) => one.missing)) assert.equal(metric.fedBy, undefined, metric.id);
});

test("a tile with no value on the day says so once in its terminal line", () => {
  const [line] = scorecardLines(scorecardOf(readingOf(), DAY)).filter((one) => one.includes("consults that ended at their call budget"));
  assert.equal(line, "  consults that ended at their call budget: none on this day (lower is better, G-06)");
});

/* An owner-wait reading made by hand: each day's answered waits as minutes, or why it was not read,
   and the waits open at the page's day's end. */
const waitsReading = (days, open = { waits: [] }) => ({ ...readingOf(), waits: { day: DAY, open,
  days: Object.fromEntries(Object.entries(days).map(([day, held]) => [day, Array.isArray(held)
    ? { answered: held.map((minutes, index) => ({ project: "proj", issueId: `ISS-${index}`, minutes })) } : held])) } });

test("2, 9, 10, 13, 15. the owner wait is the minutes answered on the day, the open waits said apart and carried whole", () => {
  const open = { waits: [{ project: "proj", issueId: "ISS-7", since: "2026-09-20T20:00:00.000Z", minutes: 240 }] };
  const tile = tileIn(scorecardOf(waitsReading({ [DAY]: [30, 45.5] }, open), DAY), "ownerWait");
  assert.deepEqual([tile.value, tile.missing, tile.unread], [75.5, null, null], "240 open minutes are not in the value");
  assert.equal(tile.detail, "2 wait(s) on a person answered on this day; 1 still open at its end: proj ISS-7 240 min");
  assert.deepEqual(tile.open, open);
});

test("8. a day read whole with no wait answered reads nought, and says none open", () => {
  const tile = tileIn(scorecardOf(waitsReading({ [DAY]: [] }), DAY), "ownerWait");
  assert.equal(tile.value, 0);
  assert.equal(tile.detail, "0 wait(s) on a person answered on this day; none open at its end");
});

test("12. open waits not read are said so while the day's minutes stand", () => {
  const tile = tileIn(scorecardOf(waitsReading({ [DAY]: [20] }, { unread: "proj: the tracker answered 503" }), DAY), "ownerWait");
  assert.equal(tile.value, 20);
  assert.equal(tile.detail, "1 wait(s) on a person answered on this day; open waits not read: proj: the tracker answered 503");
});

test("1, 14. the owner wait takes a baseline over the days before that were read, lower being better, and a day not read is no nought", () => {
  const scorecard = scorecardOf(waitsReading({ "2026-09-14": [60], "2026-09-15": [100, 20], "2026-09-16": { unread: "proj: 503" },
    [DAY]: [90] }), DAY);
  const tile = tileIn(scorecard, "ownerWait");
  assert.deepEqual([tile.value, tile.baseline, tile.baselineDays, tile.change, tile.verdict], [90, 90, 2, 0, "steady"],
    "60 and 120 before, the unread day left out");
  const worse = tileIn(scorecardOf(waitsReading({ "2026-09-14": [60], [DAY]: [90] }), DAY), "ownerWait");
  assert.equal(worse.verdict, "worse", "more minutes waited on a person is worse");
  const unread = tileIn(scorecardOf(waitsReading({ [DAY]: { unread: "proj: the tracker answered 503" } }), DAY), "ownerWait");
  assert.deepEqual([unread.value, unread.unread], [null, "proj: the tracker answered 503"]);
  const [line] = scorecardLines([unread]);
  assert.ok(scorecardLines([unread]).includes("  owner wait minutes: not read: proj: the tracker answered 503 (lower is better, G-11)"), line);
});
