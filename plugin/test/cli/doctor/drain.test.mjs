/* Which master drains `developed`, which is the project file's key because the tracker's pipeline
   schema declares none: the row, the two readings the pair cannot mean, and the one write that
   clears the key with the judgement it was named for. docs/cli/doctor.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const state = {
  answer: {
    forge_guide: () => ({ guides: [] }),
    forge_config: (args) => (args.action === "get"
      ? { config: { baseBranch: "master", productionBranch: "master",
        pipelineConfig: state.settings?.pipelineConfig ?? {} } }
      : undefined),
  },
  config: { pipelineConfig: { autoProdDeploy: false, qa: "independent" } },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const room = tempHome("doctor-drain");
test.after(() => {
  chmodSync(room.path, 0o755);
  room.remove();
});
const file = join(room.path, ".forge.json");

/** One file and one project record per case: every case here is about what one call left behind. */
const fresh = (drain, qa = "independent") => {
  chmodSync(room.path, 0o755);
  if (existsSync(file)) chmodSync(file, 0o644);
  writeFileSync(file, `{\n  "slug": "forge-plugin",\n${drain === null ? ""
    : `  "drainedBy": ${JSON.stringify(drain)},\n`}  "runs": 2\n}\n`);
  state.settings = { pipelineConfig: { autoProdDeploy: false, qa }, projectFacts: {} };
  state.calls = [];
};

const ask = (...argv) => ranAsync(FORGE, ["doctor", ...argv], tracker.env, room.path);
const sent = () => (state.calls ?? []).filter((one) => one.method === "PATCH");
const held = () => JSON.parse(readFileSync(file, "utf8"));
/* Root passes a mode check every other user fails, so the two unwritable cases say so rather than
   reporting a refusal nobody produced. */
const asRoot = process.getuid?.() === 0;

test("the declared master is a row of its own, read off the project's file", async () => {
  fresh("qa-master");
  const run = await ask();
  assert.match(run.stdout,
    /\[ {2}ok {2}\] drained by\s+qa-master claims this project's issues at developed {2}← \.forge\.json/u,
    run.stdout);
  assert.doesNotMatch(run.stdout, /^\[ miss \] drained by/mu,
    "a declared master under an independent judgement is the pair meaning what it says");
});

test("a project that declared nothing is told which master it gets and where that came from", async () => {
  fresh(null);
  const run = await ask();
  assert.match(run.stdout,
    /\[ {2}ok {2}\] drained by\s+dispatcher claims this project's issues at developed {2}← the plugin's default/u,
    run.stdout);
});

test("a value the key does not take names no master and is a miss", async () => {
  fresh("qa-mastre");
  const run = await ask();
  assert.match(run.stdout, /^\[ miss \] drained by\s+`drainedBy` is `qa-mastre`, which is no master that drains developed/mu,
    run.stdout);
  assert.match(run.stdout, /it takes dispatcher or qa-master/u, "the refusal names the values it takes");
  assert.doesNotMatch(run.stdout, /^\[ {2}ok {2}\] drained by/mu,
    "a typo that fell back to the dispatcher is the invisible failure the key exists to prevent");
});

test("a master named while the judgement is not independent is the clash, reported and not reconciled", async () => {
  fresh("qa-master", "builder");
  const run = await ask();
  assert.match(run.stdout,
    /^\[ miss \] drained by\s+`drainedBy` names qa-master and the judgement between developed and testing is builder/mu,
    run.stdout);
  assert.match(run.stdout, /nothing is offered at that status for it to drain/u,
    "the sentence says why the combination cannot mean anything");
  assert.match(run.stdout, /set the judgement to independent, or take the key out/u,
    "and what to do about it");
});

test("the write that moves the judgement off independent clears the drain key with it", async () => {
  fresh("qa-master");
  const run = await ask("--set", "pipeline.qa=builder");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^drainedBy: cleared, the judgement it named a master for having moved {2}← /mu,
    run.stdout);
  assert.equal(held().drainedBy, undefined, "the key is gone from the file, not set to something inert");
  assert.deepEqual(Object.keys(held()), ["slug", "runs"], "and every other key of it is as it was");
});

test("a write that moves no judgement leaves the key standing", async () => {
  fresh("qa-master");
  const run = await ask("--set", "pipeline.autoProdDeploy=true");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(held().drainedBy, "qa-master",
    "the judgement the key answers to did not move, so undoing a declaration nobody touched would be a loss");
  assert.doesNotMatch(run.stdout, /drainedBy: cleared/u);
});

test("selecting a flow that asks for no judgement leaves the key standing", async () => {
  fresh("qa-master");
  const run = await ask("--flow", "default");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(held().drainedBy, "qa-master",
    "that flow asks this project for nothing, so it undid a declaration it never touched");
  assert.equal(held().flow, "default", "and the half it does write landed");
});

test("a project file that cannot be rewritten refuses the write before the tracker is sent anything", { skip: asRoot }, async () => {
  fresh("qa-master");
  chmodSync(file, 0o444);
  const run = await ask("--set", "pipeline.qa=builder");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /could not be read and rewritten, so that half is out of reach and nothing was sent/u,
    run.stderr);
  assert.equal(sent().length, 0, "a judgement that landed over a file this could not clear is the orphan itself");
  assert.equal(state.settings.pipelineConfig.qa, "independent");
});

test("a file that fails after the tracker kept the judgement names what stands and the call that settles it", { skip: asRoot }, async () => {
  fresh("qa-master");
  chmodSync(room.path, 0o555);
  const run = await ask("--set", "pipeline.qa=builder");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /pipeline\.qa is "builder" on the tracker now and .* could not be written/u,
    run.stderr);
  assert.match(run.stderr, /a master named for a judgement nobody asked for/u);
  assert.match(run.stderr, /Send the same command again once that file can be written/u,
    "the refusal carries the one call that clears it rather than a description of the state");
  assert.equal(held().drainedBy, "qa-master", "and the file is as it was, so the same call is the undo");
});
