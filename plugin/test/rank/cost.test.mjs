/* The three signals beside the score, and the corpus the first of them is folded out of: a
   transcript root laid out as the harness lays one out, so the reading is the real one. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { bandsOf, costFor, isWarm, lastLanded, measuredRuns, owesRestart } from "../../src/rank/cost.mjs";
import { tempRoom } from "../fixtures.mjs";

const stamp = (minutes) => new Date(Date.parse("2026-09-01T00:00:00.000Z") + minutes * 60_000).toISOString();

const record = (at, content) => `${JSON.stringify({ timestamp: stamp(at), message: { content } })}\n`;

/* One run: the brief that marks it as issue-flow, a claim naming the issue, and the two moments the
   wall clock is measured between. */
const transcript = (root, session, key, minutes) => {
  const tasks = join(root, session, "tasks");
  mkdirSync(tasks, { recursive: true });
  const use = { type: "tool_use", id: "t1", name: "Bash", input: { command: `forge claim ${key}` } };
  writeFileSync(join(tasks, "a1b2c3.output"), [
    record(0, "issue-flow: work this issue"),
    record(1, [use]),
    record(2, [{ type: "tool_result", tool_use_id: "t1", content: "claimed" }]),
    record(minutes, "done"),
  ].join(""));
};

test("a run's minutes are folded under the issue it claimed", () => {
  const root = tempRoom("rank-cost-");
  transcript(root, "one", "ISS-11", 40);
  transcript(root, "two", "ISS-12", 60);
  transcript(root, "three", "ISS-13", 80);
  const runs = measuredRuns(root);
  assert.deepEqual(runs.map((one) => one.key).sort(), ["ISS-11", "ISS-12", "ISS-13"]);
  assert.deepEqual(runs.map((one) => Math.round(one.minutes)).sort((a, b) => a - b), [40, 60, 80]);
});

test("a transcript with no run in it costs the column nothing and leaves a dash", () => {
  const held = costFor("xs", [], new Map());
  assert.deepEqual(held, { minutes: null, over: 0, band: null });
});

/* A dash where a corpus exists would read as no corpus at all, so a band nothing landed in says
   what it fell back to instead of going quiet. */
test("a band no past run landed in falls back to every run and says which", () => {
  const runs = [{ key: "ISS-11", minutes: 40 }, { key: "ISS-12", minutes: 60 }, { key: "ISS-13", minutes: 80 }];
  const bands = new Map([["ISS-11", "unset"], ["ISS-12", "unset"], ["ISS-13", "m"]]);
  const own = costFor("unset", runs, bands);
  assert.deepEqual(own, { minutes: 50, over: 2, band: "unset" });
  const none = costFor("xs", runs, bands);
  assert.equal(none.minutes, 60, "the median of all three");
  assert.equal(none.over, 3);
  assert.equal(none.band, null, "and the band it could not answer at is not claimed");
});

test("the band of a past run is read off the browse projection alone", () => {
  const bands = bandsOf([{ issueId: "ISS-11", complexity: "m" }, { issueId: "ISS-12", complexity: null }]);
  assert.equal(bands.get("ISS-11"), "m");
  assert.equal(bands.get("ISS-12"), "unset", "no body was read, so no Size line could decide");
});

test("a body naming a hook or a skill owes a restart, and one naming neither does not", () => {
  assert.equal(owesRestart("It edits `plugin/hooks/gates/shell.mjs`."), true);
  assert.equal(owesRestart("It edits `plugin/skills/issue-flow/SKILL.md`."), true);
  assert.equal(owesRestart("It edits `plugin/src/rank/next.mjs`."), false);
  assert.equal(owesRestart("It mentions plugin/hooks without a span."), false);
});

test("the last landing is the newest mark the tracker stamped, and the warm tree is read off it", () => {
  const rows = [
    { issueId: "ISS-11", mergedAt: "2026-09-01T00:00:00.000Z" },
    { issueId: "ISS-12", mergedAt: "2026-09-04T00:00:00.000Z" },
    { issueId: "ISS-13", mergedAt: null },
  ];
  assert.equal(lastLanded(rows).issueId, "ISS-12");
  assert.equal(lastLanded([{ issueId: "ISS-13", mergedAt: null }]), null);
  assert.equal(isWarm("It touches `plugin/src/rank/next.mjs`.", ["plugin/src/rank/"]), true);
  assert.equal(isWarm("It touches `plugin/src/codex/`.", ["plugin/src/rank/"]), false);
});
