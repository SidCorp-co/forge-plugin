/* The calendar day the report is cut on: what parses, where a day begins in the device's zone, and
   which day each refusal names. */
import assert from "node:assert/strict";
import test from "node:test";

import { boundsOf, dayIn, dayRefusal, heldRange, trendDays, weekBefore, yesterday } from "../../../src/stats/daily/day.mjs";

test("a day parses only where the calendar has it", () => {
  assert.equal(dayIn("2026-09-20"), "2026-09-20");
  for (const wrong of ["2026-13-40", "2026-02-30", "20260920", "yesterday", undefined]) assert.equal(dayIn(wrong), null, wrong);
});

test("the day is the device's own: its bounds are local midnights and yesterday is the local one", () => {
  const { from, to } = boundsOf("2026-09-20");
  assert.equal(new Date(from).getHours(), 0);
  assert.equal(new Date(from).getDate(), 20);
  assert.equal(new Date(to).getDate(), 21);
  assert.equal(yesterday(new Date(2026, 8, 21, 0, 30).getTime()), "2026-09-20");
});

test("the seven days before and the seven ending at a day are counted on the calendar", () => {
  assert.deepEqual(weekBefore("2026-03-02"), ["2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01"]);
  assert.deepEqual(trendDays("2026-03-02").at(-1), "2026-03-02");
});

test("each refusal names the days held, and a held day is none", () => {
  const range = heldRange(new Date(2026, 8, 10, 9).getTime(), new Date(2026, 8, 21, 9).getTime());
  assert.deepEqual(range, { from: "2026-09-10", to: "2026-09-20" });
  assert.equal(dayRefusal("2026-09-15", range), null);
  assert.match(dayRefusal("2026-9-15", range), /not `2026-9-15`\. The days held run from 2026-09-10 to 2026-09-20\./u);
  assert.match(dayRefusal("2026-09-21", range), /has not ended/u);
  assert.match(dayRefusal("2026-09-01", range), /earlier than anything/u);
  assert.match(dayRefusal("2026-09-01", heldRange(null)), /No day is held yet/u);
});
