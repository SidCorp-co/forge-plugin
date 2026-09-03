/* The refusal path answers from the tool's own schema, so what is tested is the walk: a key that
   is real but one level out has to be found where it actually lives. */
import assert from "node:assert/strict";
import test from "node:test";

import { keyPaths, REFERENCE_KEYS } from "../src/tracker/rpc.mjs";

/* The shape forge_issues declares: an id at the top, and `data` carrying a same-named field that
   means something else. That collision is the whole reason a key is never relocated for you. */
const SCHEMA = {
  properties: {
    action: { type: "string", enum: ["get", "update", "mark_merged"] },
    documentId: { type: "string" },
    data: {
      properties: {
        issueId: { type: "string" },
        status: { type: "string" },
        relations: {
          items: { properties: { dependsOnId: { type: "string" } } },
        },
      },
    },
    filters: { properties: { label: {} } },
  },
};

test("a key one level out is found where it lives", () => {
  assert.deepEqual(keyPaths(SCHEMA, "issueId"), ["data.issueId"]);
});

test("a top-level key reports itself", () => {
  assert.deepEqual(keyPaths(SCHEMA, "documentId"), ["documentId"]);
});

test("a key inside an array marks the array", () => {
  assert.deepEqual(keyPaths(SCHEMA, "dependsOnId"), ["data.relations[].dependsOnId"]);
});

test("a key the schema does not have finds nothing", () => {
  assert.deepEqual(keyPaths(SCHEMA, "sales_admin"), []);
});

test("a branching schema is searched through every branch", () => {
  const branched = { anyOf: [{ properties: { a: {} } }, { properties: { b: {} } }] };
  assert.deepEqual(keyPaths(branched, "b"), ["b"]);
});

test("a cycle does not run away", () => {
  const cyclic = { properties: { self: {} } };
  cyclic.properties.self = cyclic;
  assert.equal(keyPaths(cyclic, "missing").length, 0);
});

test("the identifying argument is derivable from the reference set", () => {
  const top = Object.keys(SCHEMA.properties).filter((key) => REFERENCE_KEYS.has(key));
  assert.deepEqual(top, ["documentId"]);
  assert.ok(REFERENCE_KEYS.has("issueId"));
});
