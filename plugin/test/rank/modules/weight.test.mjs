/* The pure half of the module term: the walk up a module's parents, the row a weight is read from,
   the keys a table names that no module is, and an issue's primary off a search row. */
import assert from "node:assert/strict";
import test from "node:test";

import { lineOf, undefinedKeys, weightOf } from "../../../src/tracker/modules/definition.mjs";
import { primaryOf } from "../../../src/tracker/modules/attribution.mjs";

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

test("a module the tracker calls unset takes its ancestor's row, not the fallback that shares its name", () => {
  const named = [
    { id: "p", name: "platform", parentId: null },
    { id: "u", name: "unset", parentId: "p" },
  ];
  assert.deepEqual(weightOf(named[1], named, { platform: 10, unset: 0 }, "unset"),
    { points: 10, row: "platform", via: "platform" });
  assert.deepEqual(weightOf({ id: "v", name: "unset", parentId: null }, [], { unset: 3 }, "unset"),
    { points: 3, row: "unset", via: null }, "with no ancestor it lands on the fallback, said as the fallback");
});
