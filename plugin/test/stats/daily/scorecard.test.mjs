/* The scorecard's table and its arithmetic: what each metric declares, how a day's value, its
   baseline and its verdict are read off the corpora, and which tile each section of the page's
   reading points at. Runs are the `stats runs` fixture moved onto chosen days, whose friction is
   one refusal, one command typed three times and one long wait over sixteen calls. */
import assert from "node:assert/strict";
import test from "node:test";

import { METRICS, changeSaid, scorecardOf, tileOfSection, verdictOf } from "../../../src/stats/daily/scorecard.mjs";
import { SECTIONS } from "../../../src/stats/daily/reading/figures.mjs";
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
    assert.ok(metric.of || metric.missing?.issue, `${metric.id} is read, or names the reader it waits for`);
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

test("a metric no reader computes is a tile with no figure, naming the issue that owes its reader", () => {
  const scorecard = scorecardOf(readingOf({ runs: runsOn(DAY) }), DAY);
  for (const [id, issue] of [["closed", "ISS-2599"], ["minutesPerClosed", "ISS-2599"], ["firstGate", "ISS-2425"], ["ownerWait", "ISS-2600"]]) {
    const tile = tileIn(scorecard, id);
    assert.equal(tile.missing.issue, issue, id);
    assert.deepEqual([tile.value, tile.baseline, tile.change, tile.verdict], [null, null, null, null], id);
  }
});

test("every section of the page's reading answers to exactly one tile", () => {
  for (const section of SECTIONS) {
    const answering = METRICS.filter((one) => one.answers.includes(section.id));
    assert.equal(answering.length, 1, `${section.id} is answered by ${answering.map((one) => one.id).join(", ") || "no tile"}`);
    assert.equal(tileOfSection(section.id), answering[0]);
  }
  const named = METRICS.flatMap((one) => one.answers);
  assert.ok(named.every((id) => SECTIONS.some((section) => section.id === id)), "and no metric names a section the reading lacks");
});
