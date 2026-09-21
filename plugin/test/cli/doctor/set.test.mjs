/* The project's own configuration, written one key at a time. Two resources answer, so which one a
   key belongs to is the whole question, and a tracker that takes a write and keeps nothing is the
   case the read back exists for: docs/cli/doctor.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, statSync } from "node:fs";

import { cleanRepo, escaped, fakeTracker, projectEntry, projectRecord, projectRoom, ranAsync,
  tempHome } from "../../fixtures.mjs";
import { MACHINE_KEYS } from "../../../src/tools/doctor-keys.mjs";

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
/* Every call below stands in this checkout, so what it writes is this machine's record of THIS
   project: written under the home these calls run against, keyed by the repository's root folder
   the way the resolver keys it (ISS-1403). */
const OURS = projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME, { slug: "forge-plugin" });
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

test("a key no resource holds is refused with every key set, and nothing is sent", async () => {
  state.calls = [];
  const run = await ask("--set", "qa=independent");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`qa` is no key any of this project's configuration resources holds/u);
  assert.match(run.stderr, /^ {2}pipeline: autoProdDeploy$/mu);
  assert.match(run.stderr, /^ {2}fact: the-gate, the-stack$/mu);
  assert.match(run.stderr, /^ {2}project: slug, translate, runs, /mu,
    "the third resource lists the keys this plugin READS out of that file, not the ones it holds");
  assert.match(run.stderr, /--set pipeline\.qa=<value> or --set fact\.qa=<value>/u);
  assert.doesNotMatch(run.stderr, /--set project\.qa=<value>/u,
    "and no route is offered into a file where nothing would read the key (ISS-1643)");
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
  assert.match(run.stderr, /--set takes `key=value`, not `autoProdDeploy`\./u, run.stderr);
  assert.match(run.stderr, /Nothing was sent: forge doctor --set <key>=<value>/u,
    "the shared reading refuses, and this verb's own way out is still on the end of it");
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
  projectRoom(room.path, tracker.env.XDG_CONFIG_HOME, {});
  state.calls = [];
  const run = await ranAsync(FORGE, ["doctor", "--set", "autoProdDeploy=true"], tracker.env, room.path);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /slug/u, "which key the checkout owes");
  assert.equal(state.calls.length, 0);
});

/* A project this machine has never held a key for has no entry at all, and refusing there would
   leave `slug` unsettable in the one checkout that owes it — every other route needs the slug
   first. So the first write creates the file, owner-only like everything else this plugin keeps
   under that directory (ISS-1403). */
test("a checkout this machine holds no record of has that record created by the first write", async () => {
  const room = cleanRepo();
  const entry = projectEntry(room, tracker.env.XDG_CONFIG_HOME);
  assert.equal(existsSync(entry), false, "this project has no record on this machine yet");
  state.calls = [];
  const run = await ranAsync(FORGE, ["doctor", "--set", "slug=a-fresh-project"], tracker.env, room);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout,
    new RegExp(`^project\\.slug: "a-fresh-project" {2}← ${escaped(entry)}$`, "mu"), run.stdout);
  assert.deepEqual(JSON.parse(readFileSync(entry, "utf8")), { slug: "a-fresh-project" });
  assert.equal(statSync(entry).mode & 0o777, 0o600,
    "created owner-only, this file sitting beside the credential rather than in anybody's tree");
  assert.equal(state.calls.length, 0, "a key this plugin reads for itself asks the tracker nothing");
});

/* The one directory left with nothing to write: a project's record is found by its repository's
   root folder, so a directory belonging to no repository is not a project that has set nothing —
   it is no project at all, and the refusal says which of the two it met. */
test("a directory belonging to no checkout is refused, and no record is invented for it", async () => {
  const room = tempHome("doctor-set-treeless");
  state.calls = [];
  const run = await ranAsync(FORGE, ["doctor", "--set", "slug=nowhere"], tracker.env, room.path);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /this directory belongs to no checkout, so there is no project to configure/u,
    run.stderr);
  assert.match(run.stderr, /Run this from inside a checkout/u, "and the one thing that clears it");
  assert.equal(state.calls.length, 0);
});

/* Which level holds a key is decided in one place and a key of the other level is refused by its
   own name: written to both, one switch would need a precedence rule, and a report of which layer
   won is the undo BR-08 asks for and nothing would print (ISS-1403). Every key of the machine's
   set, so one added to a row without a route here goes red. */
test("a key this machine owns is refused by name with the route that writes it, and nothing is written", async () => {
  for (const [key, route] of Object.entries(MACHINE_KEYS)) {
    state.calls = [];
    const run = await ask("--set", `${key}=some-value`);
    assert.equal(run.status, 1, `\`${key}\` was taken: ${run.stdout}`);
    assert.match(run.stderr, new RegExp(`\`${key}\` is this MACHINE's and not this project's`, "u"),
      run.stderr);
    assert.match(run.stderr, new RegExp(`run \`${escaped(route)}\``, "u"),
      `${key} is refused without the route that writes it: ${run.stderr}`);
    assert.equal(state.calls.filter((one) => one.method === "PATCH").length, 0);
    assert.deepEqual(JSON.parse(readFileSync(OURS, "utf8")), { slug: "forge-plugin" },
      "and the project's own record is untouched, which is the second store this must not write");
  }
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
test("a key two resources hold is refused bare, and each prefix writes only its own resource", async () => {
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
