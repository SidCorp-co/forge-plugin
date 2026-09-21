/* A run's condition and the readers of its own claims — what a run met rather than what it spent.
   Every row the verb prints off those is `runs.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";

import { classesFor } from "../../../src/stats/corpus/classes.mjs";
import { profileOf, runFrom } from "../../../src/stats/runs.mjs";
import { apiErrored, at, compacted, humanPrompt, result, use } from "../fixture-runs.mjs";

/* A run's condition, not its cost: a compaction is the harness losing what a run knew and carrying
   on, and it is counted apart from the runs that met one, because a run that compacted three times
   is one run that ran out of room and not three. An api error is a message-level record with no
   tool call on it at all, so it can never be one of this plugin's own refusals — proved here by
   keeping it apart from the one call that was refused for a reason of its own. `claim` names the
   issue this run claimed, so `run.issues` holds it, or none, so a run that claimed nothing is named
   by its own session instead. */
const minimalRun = (session, { compactions = 0, apiErrors = 0, humanPrompts = 0, refused = false, claim = null } = {}) => runFrom("/p", session, [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-1" } }),
  use(`${session}-c`, 1, "Bash", { command: "echo hi" }),
  result(`${session}-c`, 2, "hi"),
  ...(claim ? [use(`${session}-k`, 3, "Bash", { command: `forge claim ${claim}` }),
    result(`${session}-k`, 4, `${claim}  claim: session held`)] : []),
  ...(refused ? [use(`${session}-r`, 5, "Bash", { command: "grep -rn nothing docs/" }), result(`${session}-r`, 6, "", true)] : []),
  ...Array.from({ length: compactions }, (_unused, one) => compacted(10 + one)),
  ...Array.from({ length: apiErrors }, (_unused, one) => apiErrored(20 + one)),
  ...Array.from({ length: humanPrompts }, (_unused, one) => humanPrompt(30 + one)),
].join("\n"));

test("compactions and the runs that met one are two counts, because a run that compacted three times is one run that ran out of room", () => {
  const heavy = minimalRun("heavy", { compactions: 3 });
  const light = minimalRun("light", { compactions: 1 });
  const clean = minimalRun("clean", {});
  assert.equal(heavy.compactions, 3);

  const held = profileOf([heavy, light, clean]);
  assert.deepEqual(held.condition.compactions, { met: 4, runs: 2 },
    "three compactions on one run and one on another are four met and two runs, never four runs");
});

test("an api error is counted apart from a non-zero exit this plugin refused", () => {
  const errored = minimalRun("errored", { apiErrors: 1, refused: true });
  assert.equal(errored.apiErrors, 1);

  const held = profileOf([errored]);
  assert.equal(held.condition.apiErrors, 1);
  /* The refused grep is this plugin's own other error; the api error record carries no tool_use
     block at all, so it was never a call this reading could have filed under either listing. */
  const otherErrors = [...held.errors].reduce((sum, [, many]) => sum + many, 0);
  assert.equal(otherErrors, 1, "the refused grep is the one other error; the api error record is no call");
});

test("compactions and api errors print as unavailable rather than as a nought where the window holds no run", () => {
  const held = profileOf([]);
  assert.deepEqual(held.condition.compactions, { met: null, runs: null });
  assert.equal(held.condition.apiErrors, null);
});

/* Off the reader `hooks/transcripts.mjs` exports rather than a second test of what a human turn is:
   a run that carried two typed turns and one that carried one are three met and two runs, never
   three runs — the same distinction `compactions` proves above, over `isHumanPrompt` instead. */
test("human prompts and the runs that carried one are two counts, off the reader the stop-check gate uses", () => {
  const talked = minimalRun("talked", { humanPrompts: 2 });
  const once = minimalRun("once", { humanPrompts: 1 });
  const quiet = minimalRun("quiet", {});
  assert.equal(talked.humanPrompts, 2);

  const held = profileOf([talked, once, quiet]);
  assert.equal(held.condition.humanPrompts.met, 3);
  assert.equal(held.condition.humanPrompts.runs, 2,
    "two typed turns on one run and one on another are three met and two runs, never three runs");
});

test("a run a human prompt showed up inside is named by the issue it claimed, or its own session where it claimed none", () => {
  const claimed = minimalRun("claimed", { humanPrompts: 1, claim: "ISS-42" });
  const unclaimed = minimalRun("unclaimed", { humanPrompts: 1 });
  const quiet = minimalRun("quiet", {});

  const held = profileOf([claimed, unclaimed, quiet]);
  assert.deepEqual(
    new Set(held.condition.humanPrompts.named.map((one) => one.ref)),
    new Set(["ISS-42", "unclaimed"]),
    "the run that claimed ISS-42 is named by it, the one that claimed nothing by its own session, "
    + "and the run with no human prompt is named by neither",
  );
});

test("human prompts print as unavailable rather than as a nought where the window holds no run", () => {
  const held = profileOf([]);
  assert.deepEqual(held.condition.humanPrompts, { met: null, runs: null, named: [] });
});

/* The landing a run leaves ready has a class of its own now, and two readers were reading it off the
   claim's own row: whether a transcript is an issue-flow run at all, and whether a landing was left
   ready. Both are read off the new class here, so neither figure moves (ISS-1913 holds the third,
   `unshipped`, which this does not touch). */
const readyRun = (session, flag) => runFrom("/p", session, [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "a brief naming no method" } }),
  use(`${session}-k`, 1, "Bash", { command: `forge claim ISS-1 --pushed${flag}` }),
  result(`${session}-k`, 2, "ISS-1  claim: session held"),
].join("\n"));

test("the two readers of a claim are unmoved by the new class", () => {
  const ready = readyRun("ready", " --ready");
  assert.ok(ready, "a transcript whose only claim is the ready checkpoint is still an issue-flow run");
  assert.equal(ready.ships.ready, 1, "and the landing it left ready is counted");
  const pushed = readyRun("pushed", "");
  assert.equal(pushed.ships.ready, 0, "while a capture that left nothing ready is not");
  assert.equal(profileOf([ready, pushed]).runs, 2, "both are runs of the window");
});

/* The rejection reader names every class a call that read a log can carry, and the deploy row is
   carved out of three of them, so a project whose production deploys on its own reads a compound
   deploy-and-tail call as `deploy`. Left out, the one run whose rejection only that call carries
   reports none, which is the ISS-2086 defect again under a row that did not exist then. */
const ARMED = classesFor(null, { key: "deploy", deploy: true });
const REJECTED = "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. "
  + "Rejected means the remote moved: rebase, then ship --from 2";
const deployReadRun = (classes) => runFrom("/p", "deploy-log", [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-1" } }),
  use("d-s", 1, "Bash", { command: "node tools/run.mjs ship > /tmp/ship.log 2>&1" }),
  result("d-s", 2, "step 5 (gate): npm run check ..."),
  use("d-r", 3, "Bash", { command: "coolify deployment get --uuid abc; tail -3 /tmp/ship.log" }),
  result("d-r", 4, REJECTED),
].join("\n"), classes);

test("a rejection the deploy row took off the log read is still the run's", () => {
  assert.equal(deployReadRun(ARMED).ships.rejected, 1,
    "the compound call classes as deploy, and the rejection it carries is the same rejection");
  assert.equal(deployReadRun(undefined).ships.rejected, 1,
    "as it is where the row is unarmed and the same call classes as a read");
});
