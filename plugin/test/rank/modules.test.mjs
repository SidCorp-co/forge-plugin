/* The module term of the rank, end to end against a tracker whose modules and attributions a case
   sets: the weight a project's `rank.module` gives an issue's primary module, inherited up the
   parents, and what happens where there is no table or no module to weigh. */
import assert from "node:assert/strict";
import test from "node:test";

import { issue, rankRoom, standing } from "./room.mjs";
import { lineOf, primaryOf, undefinedKeys, weightOf } from "../../src/tracker/modules.mjs";

const { load, ran, state, close } = await rankRoom();
test.after(close);

const MODULES = [
  { id: "m-tooling", name: "tooling", kind: "module", parentId: null, description: null },
  { id: "m-gate", name: "gate", kind: "module", parentId: "m-tooling", description: null },
  { id: "m-surface", name: "surface", kind: "module", parentId: null, description: null },
  { id: "l-bug", name: "bug", kind: "label", parentId: null, description: null },
];

const under = (id, primary = true) => ({ labels: [{ id, isPrimary: primary }] });

const candidates = (run) => {
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).candidates;
};

const moduleOf = (held, key) => held.find((one) => one.issueId === key).parts.module;

const attributedCalls = () => state.calls.filter((call) => call.args?.action === "attributed");
const labelCalls = () => state.calls.filter((call) => call.name === "forge_labels");

test("an issue's primary module adds the rank.module row that module has", async () => {
  state.labels = MODULES;
  load([issue("ISS-1", { priority: "high" }), issue("ISS-2", { priority: "medium", ...under("m-surface") })]);
  const held = candidates(await ran(["next", "--json"], standing({ module: { surface: 25 } })));
  assert.deepEqual(moduleOf(held, "ISS-2"), { said: "surface", points: 25 });
  assert.equal(held[0].issueId, "ISS-2", "the module's 25 outweighs the priority band's 10");
});

test("a module with no row scores its nearest ancestor's row, and one with none scores unset", async () => {
  state.labels = MODULES;
  load([issue("ISS-1", under("m-gate")), issue("ISS-2", under("m-surface")), issue("ISS-3", under("m-tooling"))]);
  const held = candidates(await ran(["next", "--json"], standing({ module: { tooling: -7, unset: 3 } })));
  assert.deepEqual(moduleOf(held, "ISS-1"), { said: "gate (tooling's row)", points: -7 });
  assert.deepEqual(moduleOf(held, "ISS-3"), { said: "tooling", points: -7 });
  assert.deepEqual(moduleOf(held, "ISS-2"), { said: "surface (unset)", points: 3 });
});

test("an issue with no primary module scores the unset row, a secondary one included", async () => {
  state.labels = MODULES;
  load([issue("ISS-1"), issue("ISS-2", under("m-surface", false))]);
  const held = candidates(await ran(["next", "--json"], standing({ module: { surface: 40, unset: -2 } })));
  assert.deepEqual(moduleOf(held, "ISS-1"), { said: "none (unset)", points: -2 });
  assert.deepEqual(moduleOf(held, "ISS-2"), { said: "none (unset)", points: -2 },
    "a module carried as secondary is not the issue's module");
});

test("--why prints the module term beside the others", async () => {
  state.labels = MODULES;
  load([issue("ISS-1", under("m-surface"))]);
  const run = await ran(["next", "--why"], standing({ module: { surface: 12 } }));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /complexity [^\n]* · module surface 12 · age/u);
});

test("a rank.module key naming no module the project defines refuses the ranking and names both", async () => {
  state.labels = MODULES;
  load([issue("ISS-1")]);
  const run = await ran(["next"], standing({ module: { surfce: 5, bug: 1 } }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`rank\.module` weighs `surfce`, `bug`, which are no modules this project defines/u);
  assert.match(run.stderr, /This project defines: tooling, gate, surface\./u, "a plain label is no module");
});

test("with no rank.module table every issue scores as it did and no module read is sent", async () => {
  state.labels = MODULES;
  load([issue("ISS-1", { priority: "high" }), issue("ISS-2", under("m-surface"))]);
  state.calls.length = 0;
  const held = candidates(await ran(["next", "--json"], standing({ priority: { high: 30 } })));
  for (const one of held) {
    const { module, ...before } = one.parts;
    assert.deepEqual(module, { said: "no rank.module table", points: 0 });
    assert.equal(one.score, Object.values(before).reduce((sum, part) => sum + part.points, 0),
      `${one.issueId} scores the terms it had before, the module adding nothing`);
  }
  assert.deepEqual(labelCalls(), [], "the labels were not asked for");
  assert.deepEqual(attributedCalls(), [], "nor was any issue's module");
});

test("where the project defines no module every issue scores as it did", async () => {
  state.labels = [MODULES[3]];
  load([issue("ISS-1"), issue("ISS-2")]);
  state.calls.length = 0;
  const held = candidates(await ran(["next", "--json"], standing({ module: { unset: 9 } })));
  for (const one of held) assert.deepEqual(one.parts.module, { said: "no module defined", points: 0 });
  assert.deepEqual(attributedCalls(), [], "no attribution read where there is nothing to attribute");
});

test("forge next -h prints the module row of the table", async () => {
  const run = await ran(["next", "-h"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}module {10}unset 0 — keyed by the modules this project's tracker defines/mu);
});

test("the walk up a module's parents ends at a cycle, and the weight takes the first row on it", () => {
  const looped = [
    { id: "a", name: "a", parentId: "b" },
    { id: "b", name: "b", parentId: "a" },
  ];
  assert.deepEqual(lineOf(looped[0], looped).map((one) => one.name), ["a", "b"]);
  assert.deepEqual(weightOf(looped[0], looped, { b: 4, unset: 1 }, "unset"), { points: 4, row: "b", via: "b" });
  assert.deepEqual(weightOf(null, looped, { unset: 1 }, "unset"), { points: 1, row: "unset", via: null });
  assert.deepEqual(undefinedKeys({ a: 1, c: 2, unset: 0 }, looped, "unset"), ["c"]);
  assert.equal(primaryOf([{ labelId: "x", isPrimary: false }, { labelId: "y", isPrimary: true }]), "y");
  assert.equal(primaryOf([{ labelId: "x", isPrimary: false }]), null);
});
