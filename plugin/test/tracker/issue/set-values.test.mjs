/* What a field of an issue may hold, asked of the two routes that ask it — a filing and a set by
   hand — and over the population the declarations name rather than the one the usage rows do. */
import assert from "node:assert/strict";
import test from "node:test";

import { fieldSets } from "../../../src/checks/surface/judged-arguments.mjs";
import { homeEnv, ranAsync } from "../../fixtures.mjs";

const env = homeEnv("set-values");
process.env.XDG_CONFIG_HOME = env.XDG_CONFIG_HOME;
const { complexityRefusal, valueOutsideSet } = await import("../../../src/tracker/issue-shape.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

test("the sentence about a value outside a set is the one the filing route prints for it", async () => {
  const held = valueOutsideSet("complexity", "xxl");
  assert.equal(held.said, complexityRefusal("xxl"), "one spelling, held where the filing route holds it");
  assert.equal(held.meant, null, "and no call to print, three of the five being as near as each other");
  assert.equal(valueOutsideSet("category", "bugg").meant, "bug", "one where exactly one name is near");
  const filed = await ranAsync(FORGE,
    ["new", "a-body-never-opened.md", "--title", "t", "--category", "bug", "--complexity", "xxl"], env);
  assert.equal(filed.status, 1, filed.stdout);
  assert.ok(filed.stderr.includes(held.said), "which is what the filing route prints, unchanged");
});

test("a field the declarations name no set for is one this reading passes", () => {
  assert.equal(valueOutsideSet("title", "any words at all"), null);
  assert.equal(valueOutsideSet("complexity", "m"), null, "as is a value inside the set");
});

/* Synthetic, because today every such field also has a filter and the usage rows would agree. */
test("a field of the record with no flag or filter of its own is still in the population", () => {
  const held = fieldSets("forge_issues", { forge_issues: { filters: ["createdAfter"], widget: ["one", "two"] } });
  assert.deepEqual(held.find((one) => one.field === "widget"), { field: "widget", values: ["one", "two"] });
  assert.equal(held.some((one) => one.field === "filters"), false, "and the route's own list is no field");
});
