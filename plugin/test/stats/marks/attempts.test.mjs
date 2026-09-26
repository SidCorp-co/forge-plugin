/* The attempt and gate records a landing writes, read back as the figures `stats runs` and the daily
   page print: attempts by their opening's window and ending wherever it falls, hand-backs by cause with
   unrecorded apart, the first-gate share over the whole store, and the gate minutes spent and lost
   (ISS-2425). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync } from "node:fs";

import { ATTEMPTS, marksOf, marksPath } from "../../../src/stats/marks/marks.mjs";
import {
  attemptEnded, attemptOpened, attemptsLine, attemptsOver, gateRecorded,
} from "../../../src/stats/marks/attempts.mjs";
import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-attempts-home-");

const SCOPE = "checkout:/work/app";
const DAY_FROM = Date.parse("2026-09-25T00:00:00.000Z");
const DAY_TO = Date.parse("2026-09-26T00:00:00.000Z");
const at = (text) => `2026-09-${text}.000Z`;

const opened = (issue, when) => ({ kind: ATTEMPTS, scope: SCOPE, phase: "opened", attempt: `${issue}@${when}`, issue, at: when });
const ended = (issue, openedAt, when, outcome, extra = {}) => ({ kind: ATTEMPTS, scope: SCOPE, phase: "ended",
  attempt: `${issue}@${openedAt}`, issue, at: when, outcome, cause: null, candidate: null, ...extra });
const gate = (candidate, members, when, verdict, seconds = 120) => ({ kind: ATTEMPTS, scope: SCOPE, phase: "gate",
  gate: `${candidate}@${when}`, candidate, members, at: when, verdict, seconds });

/* One attempt whole: its opening, the one gate that judged it and its ending, a minute apart each. */
const attempt = (issue, hour, outcome, { cause = null, verdict = outcome === "landed" ? "green" : "red", candidate = `c-${issue}-${hour}` } = {}) => {
  const open = at(`25T${hour}:00:00`);
  return [opened(issue, open), gate(candidate, [issue], at(`25T${hour}:01:00`), verdict),
    ended(issue, open, at(`25T${hour}:02:00`), outcome, { cause, candidate })];
};

test("ISS-2425 21, 22. the attempts opened in the window are counted, the landed ones and the ones handed back by cause", () => {
  const records = [
    ...attempt("ISS-1", 10, "landed"),
    ...attempt("ISS-2", 11, "back", { cause: "branch" }),
    ...attempt("ISS-3", 12, "back", { cause: "combination" }),
    ...attempt("ISS-4", 13, "back", { cause: "moved-base" }),
    ...attempt("ISS-5", 14, "back", { cause: "declined", verdict: "declined" }),
    ...attempt("ISS-6", 15, "back", { cause: "tracker" }),
    ...attempt("ISS-7", 16, "back", { cause: "judge", verdict: "green" }),
  ];
  const held = attemptsOver(SCOPE, DAY_FROM, DAY_TO, records);
  assert.deepEqual([held.attempts, held.landed, held.back], [7, 1, 6]);
  assert.deepEqual(held.causes, { branch: 1, combination: 1, "moved-base": 1, declined: 1, tracker: 1, judge: 1, unrecorded: 0 });
});

test("ISS-2425 21. an attempt opened before the window is not the window's, and one opened in it is read with an ending after it", () => {
  const records = [
    opened("ISS-1", at("24T23:59:00")), ended("ISS-1", at("24T23:59:00"), at("25T00:10:00"), "landed", { candidate: "a" }),
    opened("ISS-2", at("25T23:59:00")), ended("ISS-2", at("25T23:59:00"), at("26T00:10:00"), "back", { cause: "branch" }),
  ];
  const held = attemptsOver(SCOPE, DAY_FROM, DAY_TO, records);
  assert.deepEqual([held.attempts, held.landed, held.causes.branch], [1, 0, 1]);
});

test("ISS-2425 23, 24. an opening with no ending, and a hand-back naming no cause of the set, are unrecorded", () => {
  const records = [
    opened("ISS-1", at("25T10:00:00")),
    ...attempt("ISS-2", 11, "back"),
    ...attempt("ISS-3", 12, "back", { cause: "a-cause-nobody-declared" }),
    ...attempt("ISS-4", 13, "sideways"),
  ];
  const held = attemptsOver(SCOPE, DAY_FROM, DAY_TO, records);
  assert.equal(held.causes.unrecorded, 4);
  assert.equal(held.back, 4);
  assert.equal(Object.values(held.causes).reduce((sum, many) => sum + many, 0), held.back, "every attempt not landed has one cause");
});

test("ISS-2425 25. a landing on its first gate is one judged gate since the issue's previous landing, the gate before midnight included", () => {
  const records = [
    ...attempt("ISS-1", 10, "landed"),
    /* Red the evening before, then green and landed the morning of: its second gate. */
    gate("c-2-a", ["ISS-2"], at("24T23:50:00"), "red"),
    opened("ISS-2", at("25T09:00:00")), gate("c-2-b", ["ISS-2"], at("25T09:01:00"), "green"),
    ended("ISS-2", at("25T09:00:00"), at("25T09:02:00"), "landed", { candidate: "c-2-b" }),
    /* Landed a week ago, then again today on one gate: the gate before the earlier landing is not counted. */
    gate("c-3-a", ["ISS-3"], at("18T09:01:00"), "green"),
    opened("ISS-3", at("18T09:00:00")), ended("ISS-3", at("18T09:00:00"), at("18T09:02:00"), "landed", { candidate: "c-3-a" }),
    ...attempt("ISS-3", 14, "landed"),
    /* A declined place judged nothing, so the green gate after it is still the first. */
    gate("c-4", ["ISS-4"], at("25T15:01:00"), "declined", null),
    ...attempt("ISS-4", 16, "landed"),
  ];
  const held = attemptsOver(SCOPE, DAY_FROM, DAY_TO, records);
  assert.deepEqual(held.firstGate, { landed: 4, first: 3, ungated: 0, share: 75 });
});

test("ISS-2425 26. a landing with no judged gate on record is counted apart and outside the share", () => {
  const records = [
    ...attempt("ISS-1", 10, "landed"),
    opened("ISS-2", at("25T11:00:00")), ended("ISS-2", at("25T11:00:00"), at("25T11:05:00"), "landed", { candidate: "x" }),
  ];
  const held = attemptsOver(SCOPE, DAY_FROM, DAY_TO, records);
  assert.deepEqual(held.firstGate, { landed: 2, first: 1, ungated: 1, share: 100 });
  assert.deepEqual(attemptsOver(SCOPE, DAY_FROM, DAY_TO, records.slice(3)).firstGate, { landed: 1, first: 0, ungated: 1, share: null },
    "no landing on a judged gate is no share, never nought");
});

test("ISS-2425 27, 28, 29. judged gates in the window are the minutes spent, those whose candidate never landed the minutes lost, and a declined or failed gate neither", () => {
  const records = [
    gate("green-landed", ["ISS-1"], at("25T10:00:00"), "green", 600),
    ended("ISS-1", "x", at("26T01:00:00"), "landed", { candidate: "green-landed" }),
    gate("red", ["ISS-2"], at("25T11:00:00"), "red", 300),
    gate("green-rebuilt", ["ISS-3"], at("25T12:00:00"), "green", 180),
    gate("declined", ["ISS-4"], at("25T13:00:00"), "declined", 900),
    gate("could-not-run", ["ISS-5"], at("25T14:00:00"), "error", 900),
    gate("no-seconds", ["ISS-6"], at("25T15:00:00"), "red", null),
    gate("yesterday", ["ISS-7"], at("24T15:00:00"), "red", 6000),
  ];
  const { gates } = attemptsOver(SCOPE, DAY_FROM, DAY_TO, records);
  assert.deepEqual(gates, { judged: 4, unpriced: 1, declined: 1, error: 1, minutes: 18, lostMinutes: 8 },
    "the landing after midnight still carries its gate, and the declined, the failed and yesterday's add nothing");
});

test("two projects sharing an issue key and a candidate are counted apart", () => {
  const other = (record) => ({ ...record, scope: "checkout:/work/other" });
  const records = [
    ...attempt("ISS-1", 10, "landed", { candidate: "shared" }),
    ...attempt("ISS-1", 11, "back", { cause: "branch", candidate: "shared" }).map(other),
    other(gate("shared", ["ISS-1"], at("25T09:30:00"), "red")),
    other(gate("shared", ["ISS-1"], at("25T12:00:00"), "green")),
  ];
  const held = attemptsOver(null, DAY_FROM, DAY_TO, records);
  assert.deepEqual(held.firstGate, { landed: 1, first: 1, ungated: 0, share: 100 },
    "the other project's red gate before this landing is not this one's, so this landing is still on its first");
  assert.deepEqual([held.gates.judged, held.gates.lostMinutes], [4, 6], "the other project's three gates bought nothing, whatever this one landed");
  assert.deepEqual(held.causes.branch, 1);
});

test("the line says what was counted, and says nothing was where the store holds nothing", () => {
  const records = [...attempt("ISS-1", 10, "landed"), ...attempt("ISS-2", 11, "back", { cause: "branch" }), opened("ISS-3", at("25T12:00:00"))];
  assert.equal(attemptsLine(attemptsOver(SCOPE, DAY_FROM, DAY_TO, records)),
    "attempts        3 attempt(s): 1 landed, 1 of the 1 on a judged gate on their first (100%) · 2 not landed: branch 1, "
    + "unrecorded 1 · 2 judged gate(s) spent 4 min, 2 min of it lost");
  assert.equal(attemptsLine(attemptsOver(SCOPE, DAY_FROM, DAY_TO, [])), "attempts        none recorded, so no landing attempt is read");
});

test("ISS-2425 13. what a landing writes is read back as one attempt, and no attempt opens on a candidate a landed ending carries", () => {
  const handle = attemptOpened({ root: "/work/app", issue: "ISS-1", verb: "land-ready" });
  gateRecorded({ root: "/work/app", candidate: "c0ffee", members: ["ISS-1"], verdict: "green", seconds: 90 });
  attemptEnded(handle, { outcome: "landed", candidate: "c0ffee" });
  const records = marksOf(ATTEMPTS, handle.scope);
  assert.deepEqual(records.map((one) => one.phase), ["opened", "gate", "ended"]);
  assert.deepEqual(attemptsOver(handle.scope).firstGate, { landed: 1, first: 1, ungated: 0, share: 100 });
  assert.equal(attemptOpened({ root: "/work/app", issue: "ISS-1", verb: "land-ready", candidate: "c0ffee" }), null);
  assert.equal(marksOf(ATTEMPTS, handle.scope).length, 3, "nothing written for the resume past a landed push");
  assert.ok(attemptOpened({ root: "/work/app", issue: "ISS-1", verb: "land-ready", candidate: "another" }));
});

test("ISS-2425 36. an opening, an ending and a gate record the store refuses are each said, and the write returns", (t) => {
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tempRoom("stats-attempts-shut-");
  mkdirSync(marksPath(), { recursive: true });
  const said = [];
  t.mock.method(console, "error", (line) => said.push(line));
  try {
    const handle = attemptOpened({ root: "/work/app", issue: "ISS-1", verb: "ship" });
    attemptEnded(handle, { outcome: "back", cause: "branch" });
    gateRecorded({ root: "/work/app", candidate: "c0ffee", members: ["ISS-1"], verdict: "red", seconds: 5 });
    const all = said.join("\n");
    assert.match(all, /landing attempts: the opening of ISS-1's attempt is not on record, so `forge stats runs` reads it as unrecorded; the landing goes on as it would have\./u);
    assert.match(all, /landing attempts: how ISS-1's attempt ended is not on record/u);
    assert.match(all, /landing attempts: the gate over c0ffee is not on record/u);
  } finally {
    process.env.XDG_CONFIG_HOME = was;
  }
});
