/* What the evaluator's own method serves, read through the verb rather than off the directory: the
   step at which a written judgement meets a second model, and the inputs that make the reading
   reviewable at all. Every selector here is watched failing by removing the sentence it names from
   the part under the flow it names (ISS-1997). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { flat, projectRoom, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("harness-eval-flow").path;
const { DEFAULT, SCREEN } = await import("../../../src/guides/flow.mjs");
const { NOT_MEASURED } = await import("../../../src/stats/eval/angles.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");
const FLOWS = [DEFAULT, SCREEN];

/* One configuration home for every reading, holding one record per flow: a project's keys live
   beside the machine's now, so the room and the home its record sits in travel together and neither
   is this developer's. */
const HOME = tempRoom("harness-eval-home-");
const rooms = new Map();
const roomFor = (flow) => {
  if (!rooms.has(flow)) {
    rooms.set(flow, projectRoom(tempRoom("harness-eval-flow-"), HOME,
      { slug: "harness-eval-fixture", flow }));
  }
  return rooms.get(flow);
};

/* One flow per process, the resolver answering once, so every reading spawns the verb. */
const served = (flow) => {
  const run = spawnSync(FORGE, ["guide", "harness-eval"],
    { encoding: "utf8", env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME }, cwd: roomFor(flow) });
  assert.equal(run.status, 0, `\`forge guide harness-eval\` under ${flow} exited ${run.status}: ${run.stderr}`);
  return run.stdout;
};

/** One phase of the served method, so a sentence is asserted where a run meets it and not merely
 *  somewhere in the body: a rule about filing that landed under the windows phase would pass a
 *  whole-body match and be read by nobody at the point it applies. */
const phase = (flow, heading) => {
  const whole = served(flow);
  const at = whole.indexOf(`## ${heading}`);
  assert.notEqual(at, -1, `${flow} serves no ${heading}`);
  const rest = whole.slice(at + 3);
  const ends = rest.indexOf("\n## ");
  return flat(ends === -1 ? rest : rest.slice(0, ends));
};

const words = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim().split(" ");

/** Every run of `size` words in a text, the unit a restatement is measured in: a paraphrase that
 *  shares no such run is a pointer, and one that shares any is the sentence written twice. */
const runs = (text, size) => {
  const all = words(text);
  return all.length < size ? [] : all.slice(0, all.length - size + 1).map((_, at) => all.slice(at, at + size).join(" "));
};

const RUN_LENGTH = 6;

test("the filing that proposes work waits for a second model, and the exempt one is named", () => {
  for (const flow of FLOWS) {
    const four = phase(flow, "Phase 4");
    assert.match(four, /Nothing that proposes work is posted before a second model has read it/u,
      `criterion 1: ${flow} lets a proposal land with no second reader`);
    assert.match(four, /`forge codex consult`/u,
      `criterion 1: ${flow} asks for a reading and names no verb that takes one`);
    assert.match(four, /taken on the draft and never on the filing already posted/u,
      `criterion 1: ${flow} lets the consult follow the posting, which reads as evidenced either way`);
    assert.match(four, /carries the consult it survived/u,
      `criterion 2: ${flow} asks for a consult and lets the filing keep quiet about it`);
    assert.match(four, /exempt is a line that gives a figure's direction and names neither a cause nor work to do/u,
      `criterion 3: ${flow} exempts a better figure whatever it goes on to propose`);
  }
});

test("more than one angle, chosen by the figure, and named in what is filed", () => {
  for (const flow of FLOWS) {
    const four = phase(flow, "Phase 4");
    assert.match(four, /`tech` and `ba` on every one of them/u,
      `criterion 4: ${flow} leaves a consult here satisfiable with one angle`);
    assert.match(four, /the figure decides which rather than the model that read it/u,
      `criterion 5: ${flow} hands the angle choice back to the model whose reading is under review`);
    assert.match(four, /`user` on top of those where the proposal changes text a run meets/u,
      `criterion 5: ${flow} names no figure that earns an angle beyond the two`);
    assert.match(four, /`ux` where what moves is something a person reads on a screen/u,
      `criterion 5: ${flow} leaves the fourth angle earned by nothing`);
    assert.match(four, /The filing names the angles it was read at/u,
      `criterion 6: ${flow} lets a filing claim a consult without saying who read it`);
  }
});

test("the consult is given the reasoning, the proposal, and the reading's own statement of its limit", () => {
  for (const flow of FLOWS) {
    const four = phase(flow, "Phase 4");
    assert.match(four, /The two window values, the counts on both sides, what the attribution rests on/u,
      `criterion 7: ${flow} sends a conclusion where the reasoning was owed`);
    assert.match(four, /the proposed work in the words it would be filed in/u,
      `criterion 7: ${flow} reviews the evidence and not the proposal built on it`);
    assert.match(four, /reading's own statement of what none of its angles measures/u,
      `criterion 8: ${flow} sends a board a column of prices and nothing saying they are prices`);
    assert.match(four, /block of `forge stats eval`/u,
      `criterion 8: ${flow} asks for that statement and names nowhere to take it from`);
    assert.match(four, /rather than paraphrased here/u,
      `criterion 8: ${flow} invites a copy of a sentence this repository states once`);
  }
});

/* The claim a prose rule cannot make about itself: that the pointer is a pointer. Derived from the
   shipped statement rather than from a quotation of it, so a reworded statement is measured as it
   now reads and a phase that grows a copy of it goes red on the day the copy appears. */
test("the method points at that statement and carries no run of its words", () => {
  const spans = new Set(runs(NOT_MEASURED, RUN_LENGTH));
  assert.ok(spans.size > 0, "the shipped statement is too short to measure a restatement against");
  for (const flow of FLOWS) {
    const shared = runs(phase(flow, "Phase 4"), RUN_LENGTH).filter((one) => spans.has(one));
    assert.deepEqual(shared, [], `criterion 8: ${flow} restates the eval reading's own sentence `
      + `rather than sending the evaluator to it: ${shared.join(" / ")}`);
  }
});

test("what came back is carried into the filing, the rejection with its reason", () => {
  for (const flow of FLOWS) {
    const four = phase(flow, "Phase 4");
    assert.match(four, /A finding taken changes the draft before it is posted/u,
      `criterion 9: ${flow} lets an accepted finding change nothing that gets filed`);
    assert.match(four, /A finding turned down is posted with it, together with the reason it was turned down/u,
      `criterion 9: ${flow} drops the half of the reading a later reader cannot get anywhere else`);
  }
});

test("a consult that could not run is said, and nothing stands in for it", () => {
  for (const flow of FLOWS) {
    const four = phase(flow, "Phase 4");
    assert.match(four, /says which of those happened and stands as unreviewed/u,
      `criterion 10: ${flow} lets an unread filing land looking read`);
    assert.match(four, /Nothing is read in its place/u,
      `criterion 11: ${flow} leaves the withheld verb open to a substitute reader`);
  }
});

test("a reading carries what it rests on, and the table carries the verb at the phase that spends it", () => {
  for (const flow of FLOWS) {
    assert.match(phase(flow, "Phase 3 "), /Each reading carries what it rests on as well as what it concluded/u,
      `criterion 12: ${flow} produces a conclusion with nothing under it for anyone to weigh`);
    assert.match(phase(flow, "Reference material"), /\| `forge codex consult -h`[^|]*\| Phase 4 \|/u,
      `criterion 13: ${flow} spends the verb at a phase its own table does not name`);
  }
});
