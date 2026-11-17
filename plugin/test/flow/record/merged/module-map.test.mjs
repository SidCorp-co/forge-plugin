/* A mark's answer carries core's word on the issue's module (ISS-1256): its terms and rules, and the call
   that records one the landing named. The verb says it as core words it, and nothing where core sent none. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-merged-module-map").path;
const { moduleMapSaid } = await import("../../../../src/flow/record/merged.mjs");

test("says the module map core answered on the mark, word for word", () => {
  const said = "ISS-1 sits in Execution: 0 terms, 0 rules. Record a term the work named: PUT /api/projects/p/knowledge/<slug>.";
  assert.equal(moduleMapSaid({ answer: { moduleMap: { said } }, held: "abc" }), said);
});

test("says nothing where core answered no module map, an older core or a failed read", () => {
  assert.equal(moduleMapSaid({ answer: { detail: "marked" }, held: null }), null);
  assert.equal(moduleMapSaid({ answer: { moduleMap: null }, held: null }), null);
  assert.equal(moduleMapSaid(undefined), null);
});
