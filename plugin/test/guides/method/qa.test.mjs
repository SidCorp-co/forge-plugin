/* What the drain's own method serves, read through the verb rather than off the directory: the
   rules that keep a drain honest, the reading that decides whether a judge is owed, and the judging
   run's method the qa role had none of. Every selector here is watched failing by removing the
   sentence it names from the part under the flow it names. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { fakeTracker, flat, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("qa-flow").path;
const { DEFAULT, SCREEN } = await import("../../../src/guides/flow.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");

/* One flow per process, the resolver answering once, so every reading spawns the verb. */
const served = (flow, ...argv) => {
  const dir = tempRoom("qa-flow-");
  writeFileSync(join(dir, ".forge.json"), JSON.stringify({ slug: "qa-fixture", ...(flow ? { flow } : {}) }));
  const run = spawnSync(FORGE, argv, { encoding: "utf8", env: { ...process.env }, cwd: dir });
  assert.equal(run.status, 0, `\`forge ${argv.join(" ")}\` under ${flow ?? "no key"} exited ${run.status}: ${run.stderr}`);
  return flat(run.stdout);
};

/* The bare listing reaches for the tracker's own guides beside this copy's, so that one case needs
   an endpoint where every other here needs only the directory. */
const tracker = await fakeTracker({ answer: { forge_guide: () => ({ guides: [] }) } });
test.after(() => tracker.close());

const method = (flow) => served(flow, "guide", "qa");
const judging = (flow) => served(flow, "guide", "qa", "judging");

test("the skill is listed, and its method is phased under either flow", async () => {
  const dir = tempRoom("qa-listing-");
  writeFileSync(join(dir, ".forge.json"), JSON.stringify({ slug: "qa-fixture" }));
  const listed = await ranAsync(FORGE, ["guide"], tracker.env, dir);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /^qa$/mu, "criterion 12: the copy ships the skill and offers it nowhere");
  for (const flow of [DEFAULT, SCREEN]) {
    const held = method(flow);
    assert.match(held, /# Skill: qa/u, `criteria 13 and 14: ${flow} serves no body for this skill`);
    for (const at of ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5"]) {
      assert.match(held, new RegExp(`## ${at} —`, "u"), `criteria 13 and 14: ${flow} serves no ${at}`);
    }
    assert.match(held, new RegExp(`Flow ${flow}, which this project runs`, "u"),
      "and the answer names the flow it was rendered for");
  }
});

test("the drain ends on a read that offered nothing, and on neither of the two that look like it", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    const held = method(flow);
    assert.match(held, /ends on an answer that offered nothing and reported no shortfall, and on nothing else/u,
      `criterion 18: ${flow} states no stopping condition, so a drain ends wherever it likes`);
    assert.match(held, /raising the bound the shortfall names/u,
      `criterion 19: ${flow} recognises a shortfall without a route past it, which reads the same window twice`);
    assert.match(held, /whose every row is held by another run has work standing with somebody else/u,
      `criterion 20: ${flow} lets a fully leased queue be reported as a status drained`);
    assert.match(held, /Ask the queue again once the issue in hand is finished/u,
      `criterion 21: ${flow} lets the drain work from a list it took at the start`);
  }
});

test("a repair voids the verdicts taken at the identity it replaced, and an unjudgeable issue is set down once", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    const held = method(flow);
    assert.match(held, /every criterion is judged again — not only the ones that failed/u,
      `criterion 22: ${flow} carries a pass forward onto an artifact nobody checked it against`);
    assert.match(held, /Set down means set down — an issue re-offered on every read is a queue that never drains/u,
      `criterion 25: ${flow} lets an issue it cannot judge come back on every pass`);
  }
});

test("the witnessed section is read as it stands, and answered where it is absent", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    const held = method(flow);
    assert.match(held, /Where it answers `none`, no judging run is dispatched/u,
      `criterion 23: ${flow} spends a judging run on an issue whose plan says nobody has to look`);
    assert.match(held, /carries no such section at all[\s\S]*answers the question itself rather than defaulting/u,
      `criterion 24: ${flow} defaults on the legacy plans, which is either unjudged screen work or a run per issue`);
  }
});

test("the judging reference is the dispatched run's method and not the builder's", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    const held = judging(flow);
    assert.match(held, /the method of a run dispatched to judge, not of the master that dispatched it/u,
      `criterion 15: ${flow} serves no method of its own to the role it dispatches`);
    assert.match(held, /Your brief carries the deployment identity/u,
      `criterion 15: ${flow} lets a judge derive an identity of its own`);
  }
  assert.match(judging(SCREEN), /Write the charter before any observation is mapped to a criterion/u,
    "the flow with a screen asks for the charter");
  assert.doesNotMatch(judging(DEFAULT), /charter/u,
    "and the flow with none does not, which is what that selector is watched on");
});

test("a wave takes the judging candidates only where the project declared them the dispatcher's", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    const held = served(flow, "guide", "dispatch");
    assert.match(held, /Where the project named the dispatcher, take them ahead of the ranked work/u,
      `criterion 26: ${flow} tells a wave nothing about the queue it is offered`);
    assert.match(held, /named a master of its own, leave them standing/u,
      `criterion 27: ${flow} lets a wave dispatch a judge into another master's queue`);
    assert.match(held, /A key holding a value that is neither leaves this wave nothing to act on/u,
      `criterion 27: ${flow} lets a wave act on a key nobody can read`);
  }
});
