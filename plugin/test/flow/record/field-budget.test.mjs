/* Core screens every field of a `forge-record` block at 400 characters, and a run learned the number
   only by failing: 9 of 250 `forge record` calls in the Agenfold sessions of 2026-10-30/31 came back
   `the 'moved' field is 765 characters over its 400-character budget`. The budget is printed on the
   row of every field it caps, and a value over it is refused here, before any request, naming the
   field, its length and the limit. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { neutralRoom, ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("field-budget").path;
const { KINDS } = await import("../../../src/flow/record/record-rows.mjs");
const { SHAPES } = await import("../../../src/flow/machine.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ask = (...argv) => spawnSync(FORGE, argv, { encoding: "utf8", cwd: neutralRoom(), env: process.env });

const state = { calls: [], issues: [], comments: {}, answer: {} };
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());

/* A kind written as a record block, as against one the verb writes to a field of the issue. */
const FENCED = KINDS.filter((kind) => SHAPES[kind]);

test("every record kind's help prints the budget beside each field a person types", () => {
  for (const kind of FENCED) {
    const run = ask("record", kind, "-h");
    assert.equal(run.status, 0, `${kind}: ${run.stderr}`);
    assert.match(run.stdout, /\(400\)/u, `record ${kind} -h prints no budget:\n${run.stdout}`);
    assert.match(run.stdout, /400 code points/u, `record ${kind} -h does not say what the number is`);
  }
});

/* The two other verbs that write a capped field print theirs too, read off the one table the write
   is measured against, so the number a run drafts to is the number it is refused at. */
test("comment and issue print the caps their writes are measured against", () => {
  const comment = ask("comment", "-h");
  assert.match(comment.stdout, /10000 code points/u, `forge comment -h:\n${comment.stdout}`);
  const issue = ask("issue", "-h");
  assert.match(issue.stdout, /title\(500\)/u, `forge issue -h:\n${issue.stdout}`);
  assert.match(issue.stdout, /description\(100000\)/u);
});

test("a field over its budget is refused before any request, naming the field, its length and the limit", async () => {
  state.calls = [];
  const moved = "m".repeat(765);
  const run = await ranAsync(FORGE, ["record", "correction", "ISS-3", "--moved", moved, "--why", "a reason",
    "--corrects", "plan"], ENV);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--moved/u, "the field is named");
  assert.match(run.stderr, /765/u, "with its length");
  assert.match(run.stderr, /400/u, "and the limit");
  assert.deepEqual(state.calls, [], "and nothing was sent");
});

test("a repeated field is measured value by value", async () => {
  state.calls = [];
  const run = await ranAsync(FORGE, ["record", "decision", "ISS-3",
    "--decision", "read it | it holds | revert", "--decision", `${"d".repeat(420)} | it holds | revert`], ENV);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--decision/u);
  assert.match(run.stderr, /\b420\b|\b4\d\d\b/u);
  assert.deepEqual(state.calls, [], "nothing was sent");
});

test("a field at its budget is not refused for its length", async () => {
  state.calls = [];
  const run = await ranAsync(FORGE, ["record", "correction", "ISS-3", "--moved", "m".repeat(400), "--why", "a reason",
    "--corrects", "plan"], ENV);
  assert.doesNotMatch(run.stderr, /400 code points/u, run.stderr);
});
