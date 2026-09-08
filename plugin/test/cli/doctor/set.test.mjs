/* The project's own configuration, written one key at a time. Two resources answer, so which one a
   key belongs to is the whole question, and a tracker that takes a write and keeps nothing is the
   case the read back exists for: docs/cli/doctor.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;

const state = {
  answer: {
    forge_guide: () => ({ guides: [] }),
  },
  config: { pipelineConfig: { autoProdDeploy: false }, projectFacts: { "the-stack": "Node and nothing else" } },
  factsConfig: { "the-stack": { alwaysInject: true } },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const ask = (...argv) => ranAsync(FORGE, ["doctor", ...argv], tracker.env, ROOT);

test("each key of both resources is reported with the resource it was read from", async () => {
  const run = await ask();
  assert.match(run.stdout, /\[ {2}ok {2}\] pipeline\.autoProdDeploy\s+false {2}← the tracker's pipeline configuration/u,
    run.stdout);
  assert.match(run.stdout,
    /\[ {2}ok {2}\] fact\.the-stack\s+21 characters, always-inject {2}← the tracker's project facts/u,
    "a fact is prose, so its width and whether it is injected are what a report can say about it");
});

test("a key one resource already holds is routed by that and reported set", async () => {
  const run = await ask("--set", "autoProdDeploy=true");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^pipeline\.autoProdDeploy: true {2}← the tracker's pipeline configuration$/mu);
  assert.equal(state.settings.pipelineConfig.autoProdDeploy, true,
    "sent as a boolean and not as the string the shell handed over");
  await ask("--set", "autoProdDeploy=false");
});

test("a prefixed key names its resource outright, which is how one neither holds is created", async () => {
  const run = await ask("--set", "fact.the-gate=npm run check");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^fact\.the-gate: npm run check {2}← the tracker's project facts$/mu,
    "the value back off the resource's own route, which is what was read and not what was typed");
  assert.equal(state.settings.projectFacts["the-gate"], "npm run check");
});

test("a key neither resource holds is refused with both key sets, and nothing is sent", async () => {
  state.calls = [];
  const run = await ask("--set", "qa=independent");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`qa` is no key either of this project's configuration resources holds/u);
  assert.match(run.stderr, /^ {2}pipeline: autoProdDeploy$/mu);
  assert.match(run.stderr, /^ {2}fact: the-gate, the-stack$/mu);
  assert.match(run.stderr, /--set pipeline\.qa=<value> or --set fact\.qa=<value>/u);
  assert.equal(state.calls.filter((one) => one.method === "PATCH").length, 0);
});

/* The whole reason the write reads back. The tracker's own schema drops a key it does not declare,
   and the write answers 200 either way, so a run told *set* would act on a value nothing holds. */
test("a key the tracker takes and does not keep is refused, naming the strip", async () => {
  state.stripped = ["qa"];
  try {
    const run = await ask("--set", "pipeline.qa=independent");
    assert.equal(run.status, 1);
    assert.match(run.stderr, /pipeline\.qa was sent as "independent" and the tracker's pipeline configuration reads back null/u);
    assert.match(run.stderr, /a key its own schema does not declare is dropped on the way in/u);
  } finally {
    state.stripped = [];
  }
});

test("a pair with no `=` in it is refused before either resource is read", async () => {
  state.calls = [];
  const run = await ask("--set", "autoProdDeploy");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--set takes one key and its value, joined by `=`/u);
  assert.equal(state.calls.length, 0);
});

test("a resource named with no key of it is refused with the usage", async () => {
  const run = await ask("--set", "pipeline.=1");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /names the resource and no key of it/u);
});

/* Nothing is sent from a checkout that names no project: the resolution is the first thing the
   write does, so a call made in the wrong directory costs a refusal and no round trip. */
test("a checkout naming no project is refused before anything is read", async () => {
  const room = tempHome("doctor-set-unscoped");
  writeFileSync(join(room.path, ".forge.json"), JSON.stringify({}));
  state.calls = [];
  const run = await ranAsync(FORGE, ["doctor", "--set", "autoProdDeploy=true"], tracker.env, room.path);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /slug/u, "which key the checkout owes");
  assert.equal(state.calls.length, 0);
});

test("a write and a brief write in one call are refused rather than one of them preferred", async () => {
  const run = await ask("--set", "autoProdDeploy=true", "--confirm", "CLAUDE.md");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /two resources and two calls/u);
});

/* The brief's body fields are the one write that takes a body: beside a key write they would be
   dropped, and a caller told a title was set that nothing stored has been told the wrong thing. */
test("a body's field beside --set is refused rather than dropped, and nothing is sent", async () => {
  for (const carried of [["--title", "A title"], ["--confidence", "high"], ["--meta", "k=v"]]) {
    state.calls = [];
    const run = await ask("--set", "autoProdDeploy=true", ...carried);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /are written with a body, so they belong to --refresh/u, run.stderr);
    assert.match(run.stderr, /--set writes one key of the project's configuration and takes neither/u);
    assert.equal(state.calls.filter((one) => one.method === "PATCH").length, 0);
  }
});

/* The project's record and this machine's keys are two stores, and the project write answers before
   the machine's ever runs: a call naming both is refused rather than half-done. */
test("a project write beside a machine key is refused, and neither half is written", async () => {
  state.calls = [];
  for (const machine of [["--token", "a-throwaway-token"], ["--hide", "knowledge"], ["--ship", "solo"]]) {
    const run = await ask("--set", "autoProdDeploy=true", ...machine);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /--set` writes the project's own record and `--/u, run.stderr);
    assert.match(run.stderr, /two stores and two calls/u);
  }
  assert.equal(state.calls.filter((one) => one.method === "PATCH").length, 0);
});

/* Routing by which resource holds the key answers nothing when both do, and one of the two here is
   a deploy switch: a bare name is refused so the prefix decides, rather than the order of a list. */
test("a key both resources hold is refused bare, and each prefix writes only its own resource", async () => {
  await ask("--set", "fact.autoProdDeploy=what the branch means");
  try {
    state.calls = [];
    const bare = await ask("--set", "autoProdDeploy=true");
    assert.equal(bare.status, 1);
    assert.match(bare.stderr, /`autoProdDeploy` is a key pipeline and fact both hold/u, bare.stderr);
    assert.match(bare.stderr, /--set pipeline\.autoProdDeploy=<value> or --set fact\.autoProdDeploy=<value>/u);
    assert.equal(state.calls.filter((one) => one.method === "PATCH").length, 0);
    const pipeline = await ask("--set", "pipeline.autoProdDeploy=true");
    assert.equal(pipeline.status, 0, pipeline.stderr);
    assert.equal(state.settings.pipelineConfig.autoProdDeploy, true);
    assert.equal(state.settings.projectFacts.autoProdDeploy, "what the branch means",
      "and the resource that was not named kept what it had");
  } finally {
    delete state.settings.projectFacts.autoProdDeploy;
    state.settings.pipelineConfig.autoProdDeploy = false;
  }
});
