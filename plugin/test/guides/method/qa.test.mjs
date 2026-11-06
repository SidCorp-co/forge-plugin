/* What the drain's own method serves, read through the verb rather than off the directory: the
   rules that keep a drain honest, the reading that decides whether a judge is owed, and the judging
   run's method the qa role had none of. Every selector here is watched failing by removing the
   sentence it names from the part under the flow it names. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { flat, projectRoom, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("qa-flow").path;
const { DEFAULT, SCREEN } = await import("../../../src/guides/flow.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");

/* One configuration home for every reading, holding one record per flow: the project's keys live
   beside the machine's now, so a room and the home its record sits in travel together and neither
   is this developer's. */
const HOME = tempRoom("qa-flow-home-");
const rooms = new Map();
const roomFor = (flow) => {
  if (!rooms.has(flow)) {
    rooms.set(flow, projectRoom(tempRoom("qa-flow-"), HOME,
      { slug: "qa-fixture", ...(flow ? { flow } : {}) }));
  }
  return rooms.get(flow);
};

/* One flow per process, the resolver answering once, so every reading spawns the verb. */
const served = (flow, ...argv) => {
  const run = spawnSync(FORGE, argv,
    { encoding: "utf8", env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME }, cwd: roomFor(flow) });
  assert.equal(run.status, 0, `\`forge ${argv.join(" ")}\` under ${flow ?? "no key"} exited ${run.status}: ${run.stderr}`);
  return flat(run.stdout);
};

const judging = (flow) => served(flow, "guide", "qa", "judging");

test("the judging reference is the dispatched run's method and not the builder's", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    const held = judging(flow);
    assert.match(held, /the method of a run dispatched to judge, not of the master that dispatched it/u,
      `criterion 15: ${flow} serves no method of its own to the role it dispatches`);
    assert.match(held, /rather than deriving one of your own/u,
      `criterion 15: ${flow} lets a judge derive an identity of its own`);
    /* The rule the sentence above states is the ban, and the input was named as one the role was
       refused without: a method saying so sends a judge to park an issue the rung now admits, most
       issues carrying no identity at all (ISS-1788). */
    assert.match(held, /A brief carrying no identity refuses you nothing/u,
      `${flow} still reads an absent identity as a reason not to judge`);
  }
  assert.match(judging(SCREEN), /Write the charter before any observation is mapped to a criterion/u,
    "the flow with a screen asks for the charter");
  assert.doesNotMatch(judging(DEFAULT), /charter/u,
    "and the flow with none does not, which is what that selector is watched on");
});

/* The judging method has one statement per reader and the reader is what selects it, so what the
   builder's proving reference stopped carrying is owed here whole rather than by a pointer into a
   skill this run is not reading (ISS-1695). */
test("the judge's own reference carries the whole charter and the whole threshold", () => {
  const held = judging(SCREEN);
  assert.match(held, /the role you are playing, the task you are attempting, the state it starts from, the result it intends/u,
    "criterion 18: the charter does not say what it has to cover");
  assert.match(held, /one interruption or recovery, and one alternate state or role/u,
    "criterion 18: the charter reaches no state the person arrives at by accident");
  assert.match(held, /What a charter is not: a redesign nobody asked for/u,
    "criterion 19: nothing bounds the charter, so a redesign nobody asked for is one");
  assert.match(held, /the task cannot be completed, its result is materially wrong, work is lost/u,
    "criterion 15: nothing says which harms make a finding blocking");
  assert.match(held, /the steps that reproduce it, the behaviour expected/u,
    "criterion 16: nothing says what a blocking finding carries");
  assert.doesNotMatch(judging(DEFAULT), /material harm to a task the change is meant to support: the task cannot/u,
    "and the judge with no screen is not given the screen judge's threshold");
});

/* The verdicts are the one part of a judging run that outlives it: two runs killed by a rate limit
   lost 55 minutes of judging because the method held the set for one write at the end (ISS-1497). */
test("the judge writes each verdict as it is judged, and a restart judges only the remainder", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    const held = judging(flow);
    assert.match(held, /Write a criterion's verdict as soon as that criterion is judged, and never hold the set for one write at the end/u,
      `criterion 1: ${flow} lets a judge hold its verdicts until the set is done`);
    assert.match(held, /Judge only the criteria carrying no verdict that counts/u,
      `criterion 2: ${flow} sends a restarted judge back over criteria a stopped run already judged`);
    assert.match(held, /`forge resume <the issue>` marks every criterion with its verdict/u,
      `criterion 2: ${flow} names no reading a restarted judge sees the coverage in`);
  }
});
