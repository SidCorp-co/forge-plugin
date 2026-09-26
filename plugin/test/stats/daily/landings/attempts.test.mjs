/* The attempt and gate records a landing wrote, as `stats runs` and the daily page print them over one
   device: the line, its `--json`, the page's Landings section and the day's `--json`, each off the same
   records (ISS-2425). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SLUG, daily, daysAgo, device, envOf } from "./fixture-daily.mjs";
import { FORGE } from "../fixture-runs.mjs";

const at = (on, time) => `${on}T${time}.000Z`;

/* On one day: ISS-1 landed on its one gate, ISS-2 red then green and landed, ISS-3 handed back for its
   branch, ISS-4 opened and never ended, and a place declined for ISS-3's second go. Gates of two
   minutes each: five judged, ten minutes, of which the two red ones' four and the two of ISS-4's green
   gate, whose candidate never landed, are lost. */
const onDay = (on) => {
  const record = (fields) => ({ kind: "landing-attempts", scope: SLUG, ...fields });
  const opened = (issue, time) => record({ phase: "opened", attempt: `${issue}@${on}${time}`, issue, at: at(on, time) });
  const ended = (issue, time, when, outcome, cause, candidate = null) =>
    record({ phase: "ended", attempt: `${issue}@${on}${time}`, issue, at: at(on, when), outcome, cause, candidate });
  const gate = (candidate, issue, when, verdict, seconds = 120) =>
    record({ phase: "gate", gate: `${candidate}@${on}${when}`, candidate: `${candidate}-${on}`, members: [issue], at: at(on, when), verdict, seconds });
  return [
    opened("ISS-1", "09:00:00"), gate("c1", "ISS-1", "09:01:00", "green"), ended("ISS-1", "09:00:00", "09:02:00", "landed", null, `c1-${on}`),
    opened("ISS-2", "10:00:00"), gate("c2a", "ISS-2", "10:01:00", "red"), ended("ISS-2", "10:00:00", "10:02:00", "back", "branch"),
    opened("ISS-2", "11:00:00"), gate("c2b", "ISS-2", "11:01:00", "green"), ended("ISS-2", "11:00:00", "11:02:00", "landed", null, `c2b-${on}`),
    opened("ISS-3", "12:00:00"), gate("c3", "ISS-3", "12:01:00", "red"), ended("ISS-3", "12:00:00", "12:02:00", "back", "branch"),
    opened("ISS-3", "13:00:00"), gate("c3b", "ISS-3", "13:01:00", "declined", null), ended("ISS-3", "13:00:00", "13:02:00", "back", "declined"),
    opened("ISS-4", "14:00:00"), gate("c4", "ISS-4", "14:01:00", "green"),
  ];
};

const FIGURES = { attempts: 6, landed: 2, back: 4,
  causes: { branch: 2, combination: 0, "moved-base": 0, declined: 1, tracker: 0, judge: 0, unrecorded: 1 },
  firstGate: { landed: 2, first: 1, ungated: 0, share: 50 },
  gates: { judged: 5, unpriced: 0, declined: 1, error: 0, minutes: 10, lostMinutes: 6 } };
const SAID = "6 attempt(s): 2 landed, 1 of the 2 on a judged gate on their first (50%) · 4 not landed: branch 2, declined 1, "
  + "unrecorded 1 · 5 judged gate(s) spent 10 min, 6 min of it lost, 1 declined";

const runsOf = (held, ...argv) => spawnSync(FORGE, ["stats", "runs", "--checkout", held.checkout, ...argv],
  { encoding: "utf8", cwd: held.room, env: envOf(held) });

test("ISS-2425 30. stats runs prints the attempts line over its window, off the records the landing wrote", () => {
  const held = device({ days: [daysAgo(1)], marks: [...onDay(daysAgo(1)), ...onDay(daysAgo(20))] });
  const week = runsOf(held, "--since", "7d");
  assert.equal(week.status, 0, week.stderr);
  assert.ok(week.stdout.includes(`attempts        ${SAID}\n`), week.stdout);
  assert.match(runsOf(held).stdout, /^attempts {8}12 attempt\(s\): 4 landed,/mu, "the whole corpus holds both days");
});

test("ISS-2425 31. stats runs --json carries the attempt figures the line prints", () => {
  const held = device({ days: [daysAgo(1)], marks: onDay(daysAgo(1)) });
  const run = runsOf(held, "--json");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).attempts, FIGURES);
});

test("a project with no attempt record says none was recorded rather than printing noughts", () => {
  const held = device({ days: [daysAgo(1)] });
  assert.match(runsOf(held).stdout, /^attempts {8}none recorded, so no landing attempt is read$/mu);
});

test("ISS-2425 32, 34. the daily page's Landings section prints the day's attempts, and names none of them missing", () => {
  const held = device({ days: [daysAgo(1)], marks: [...onDay(daysAgo(1)), ...onDay(daysAgo(3))] });
  assert.equal(daily(held, "--day", daysAgo(1)).status, 0);
  const page = readFileSync(join(held.reports, `${daysAgo(1)}.html`), "utf8");
  const landings = page.slice(page.indexOf('<details id="landings">'));
  assert.ok(landings.slice(0, landings.indexOf("</details>")).includes(`<p>Attempts: ${SAID}.</p>`), landings);
  assert.ok(!page.includes("ISS-2425"), "no figure of this reader is named as owed");
});

test("ISS-2425 33, 35. the daily --json carries the day's attempt figures and the first-gate tile reads them", () => {
  const held = device({ days: [daysAgo(1)], marks: [...onDay(daysAgo(1)), ...onDay(daysAgo(3))] });
  const run = daily(held, "--day", daysAgo(1), "--json");
  assert.equal(run.status, 0, run.stderr);
  const content = JSON.parse(run.stdout);
  assert.deepEqual(content.landings.attempts, FIGURES);
  const tile = content.scorecard.find((one) => one.metric === "firstGate");
  assert.deepEqual([tile.value, tile.baseline, tile.baselineDays, tile.change, tile.missing], [50, 50, 1, 0, null]);
});

test("a day whose only records are a landing's attempts is a day held, and both the page and its --json show them", () => {
  const held = device({ marks: onDay(daysAgo(1)) });
  assert.equal(daily(held, "--day", daysAgo(1)).status, 0);
  const page = readFileSync(join(held.reports, `${daysAgo(1)}.html`), "utf8");
  assert.ok(page.includes(`<p>Attempts: ${SAID}.</p>`), page);
  const run = daily(held, "--day", daysAgo(1), "--json");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(JSON.parse(run.stdout).landings.attempts, FIGURES);
});
