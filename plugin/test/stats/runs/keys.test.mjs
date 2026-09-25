/* The key a friction row is filed under across runs: the same command typed by runs on two issues
   is one row, and inside one run only the whole command typed again is a repeat (ISS-2491). */
import assert from "node:assert/strict";
import test from "node:test";

import { runFrom } from "../../../src/stats/runs.mjs";
import { frictionOf } from "../../../src/stats/daily/gather.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { ask, at, indexIn, result, use } from "../fixture-runs.mjs";

const TREE = (issue) => `cd /work/wt-forge-plugin-ISS-${issue} && export FORGE_SESSION_ID=iss-${issue}-${issue}abcdef`;

/* A run on one issue: whatever commands it is handed, each answered a second later, then one wait of
   eleven minutes on a gate run naming the run's own tree and session. */
const runOn = (issue, commands) => [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: `Skill forge:issue-flow ISS-${issue}` } }),
  ...commands.flatMap((command, index) => [use(`k${index}`, index * 10, "Bash", { command }), result(`k${index}`, index * 10 + 1, "ok")]),
  use("wait", 1000, "Bash", { command: `${TREE(issue)} && npm run check 2>&1 | tail -5 # ISS-${issue}` }),
  result("wait", 1660, "All 14 gate step(s) passed"),
].join("\n");

const thrice = (command) => [command, command, command];

test("one command typed three times by each of two runs on different issues is one repeat row carrying both runs' calls", () => {
  const room = tempRoom("stats-keys-");
  indexIn(room, "session-one", "a0001.output", runOn(101, thrice("forge issue ISS-101 --full")));
  indexIn(room, "session-two", "a0002.output", runOn(202, thrice("forge issue ISS-202 --full")));
  const run = ask(room, "--json");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).repeats, [["forge issue ISS-nn --full", 6]]);
});

test("inside one run, two commands differing only in the issue they name are no repeat", () => {
  const room = tempRoom("stats-keys-");
  indexIn(room, "session-one", "a0001.output", runOn(101, [
    "forge issue ISS-1 --full", "forge issue ISS-1 --full", "forge issue ISS-2 --full", "forge issue ISS-2 --full",
  ]));
  const run = ask(room, "--json");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).repeats, [], "two of each, which the mask would have made four of one");
});

test("the same long wait in two runs is one wait row of the day's friction, counting both runs", () => {
  const runs = [101, 202].map((issue) => runFrom(`/runs/${issue}`, `s-${issue}`, runOn(issue, [])));
  const { waits } = frictionOf(runs);
  assert.equal(waits.length, 1, JSON.stringify(waits));
  assert.equal(waits[0].what, "cd <path> && export FORGE_SESSION_ID=<session> && npm run check 2>&1 | tail -5 # ISS-nn");
  assert.deepEqual([waits[0].waits, waits[0].runs, waits[0].minutes], [2, 2, 22]);
});

test("stats runs still prints each single long wait's command as it was typed", () => {
  const room = tempRoom("stats-keys-");
  indexIn(room, "session-one", "a0001.output", runOn(101, []));
  indexIn(room, "session-two", "a0002.output", runOn(202, []));
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  for (const issue of [101, 202]) {
    assert.ok(run.stdout.includes(`11.0 min  ${TREE(issue)} && npm run check`), run.stdout);
  }
});
