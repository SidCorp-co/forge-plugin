/* The red-batch records a landing wrote, as `stats runs` and the daily page print them over one
   device: the line, its `--json`, the page's Landings section and the day's `--json`, each off the
   same records (ISS-2490). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SLUG, daily, daysAgo, device, envOf } from "./fixture-daily.mjs";
import { FORGE } from "../fixture-runs.mjs";

const at = (on, time) => `${on}T${time}.000Z`;
/* A set is keyed by the candidate and the moment it was opened, so each day's sets are its own. */
const set = (name, on, members, resolution) => [
  { kind: "red-batches", scope: SLUG, batch: `${name}@${on}`, phase: "opened", at: at(on, "10:00:00"), members },
  ...(resolution ? [{ kind: "red-batches", scope: SLUG, batch: `${name}@${on}`, phase: "resolved", at: at(on, "10:30:00"), members,
    back: [], alone: [], rounds: 0, ...resolution }] : []),
];

/* One of each outcome yesterday, and a set that died before its resolution: 2 + 3 + (1 + 2) gates
   spent where alone would have been 4 + 4 + 3. */
const onDay = (on) => [
  ...set("a", on, ["ISS-1", "ISS-2", "ISS-3"], { outcome: "attributed", gates: 2, back: ["ISS-1"] }),
  ...set("b", on, ["ISS-4", "ISS-5", "ISS-6"], { outcome: "split", gates: 3, rounds: 1, back: ["ISS-6"] }),
  ...set("c", on, ["ISS-7", "ISS-8"], { outcome: "one-by-one", gates: 1, alone: ["ISS-7", "ISS-8"] }),
  ...set("dead", on, ["ISS-9", "ISS-10"], null),
];
const FIGURES = { sets: 4, attributed: 1, split: 1, rounds: 1, oneByOne: 1, unknown: 1, spent: 8, alone: 11 };
const SAID = "4 red set(s) recorded: 1 attributed by paths, 1 split over 1 round(s), 1 landed one by one, 1 unknown · "
  + "the 3 resolved spent 8 gate(s) where landing each member alone would have spent 11";

const runsOf = (held, ...argv) => spawnSync(FORGE, ["stats", "runs", "--checkout", held.checkout, ...argv],
  { encoding: "utf8", cwd: held.room, env: envOf(held) });

test("stats runs prints the red batches line over its window, off the records the landing wrote", () => {
  const held = device({ days: [daysAgo(1)], marks: [...onDay(daysAgo(1)), ...onDay(daysAgo(20))] });
  const all = runsOf(held);
  assert.equal(all.status, 0, all.stderr);
  assert.match(all.stdout, /^red batches {5}8 red set\(s\) recorded: 2 attributed by paths, 2 split over 2 round\(s\), 2 landed one by one, 2 unknown · the 6 resolved spent 16 gate\(s\) where landing each member alone would have spent 22$/mu, all.stdout);
  const week = runsOf(held, "--since", "7d");
  assert.ok(week.stdout.includes(`red batches     ${SAID}\n`), week.stdout);
});

test("stats runs --json carries the red-batch figures the line prints", () => {
  const held = device({ days: [daysAgo(1)], marks: onDay(daysAgo(1)) });
  const run = runsOf(held, "--json");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).redBatches, FIGURES);
});

test("a project with no red-batch record says none was recorded rather than printing noughts", () => {
  const held = device({ days: [daysAgo(1)] });
  assert.match(runsOf(held).stdout, /^red batches {5}none recorded,/mu);
});

test("the daily page's Landings section prints the day's red-batch figures", () => {
  const held = device({ days: [daysAgo(1)], marks: [...onDay(daysAgo(1)), ...onDay(daysAgo(3))] });
  assert.equal(daily(held, "--day", daysAgo(1)).status, 0);
  const page = readFileSync(join(held.reports, `${daysAgo(1)}.html`), "utf8");
  const landings = page.slice(page.indexOf('<details id="landings">'));
  assert.ok(landings.slice(0, landings.indexOf("</details>")).includes(`<p>Red batches: ${SAID}.</p>`), landings);
});

test("the daily --json carries the day's red-batch figures", () => {
  const held = device({ days: [daysAgo(1)], marks: [...onDay(daysAgo(1)), ...onDay(daysAgo(3))] });
  const run = daily(held, "--day", daysAgo(1), "--json");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).landings.redBatches, FIGURES);
});
