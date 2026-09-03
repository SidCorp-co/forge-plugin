import assert from "node:assert/strict";
import test from "node:test";

import { commonnessCutoff, diffIdentifiers, identifiers, rank } from "../../src/checks/blast-radius.mjs";

test("prose shaped like a type name is not an identifier", () => {
  // The words that made the first measured run unreadable: capitalised English out of comments.
  const found = identifiers("// The lot is Absent, Merged, Empty. Drizzle reads it.");
  assert.deepEqual([...found], []);
});

test("camelCase, a constant, a `$` member and a tag with a digit all survive", () => {
  const found = identifiers("productUseLots VIRTUAL_LOT_NO $inferInsert G2a ActorContext");
  assert.deepEqual([...found].sort(), [
    "$inferInsert",
    "ActorContext",
    "G2a",
    "VIRTUAL_LOT_NO",
    "productUseLots",
  ]);
});

test("a deletion counts, because a reader elsewhere may still expect it", () => {
  const diff = "--- a/x.ts\n+++ b/x.ts\n@@\n-const oldName = 1;\n+const newName = 2;\n";
  const found = diffIdentifiers(diff);
  assert.ok(found.has("oldName") && found.has("newName"));
});

test("the +++/--- headers are paths, not uses", () => {
  assert.equal(diffIdentifiers("--- a/lotThing.ts\n+++ b/lotThing.ts\n").has("lotThing"), false);
});

test("the cutoff scales with the tree but has a floor for a small one", () => {
  assert.equal(commonnessCutoff(10), 8);
  assert.equal(commonnessCutoff(1000), 20);
});

/** A tree where one identifier is everywhere and one is shared by exactly two files. */
function fixture() {
  const everywhere = Array.from({ length: 500 }, (_, i) => [`common/f${i}.ts`, "sharedThing"]);
  return [
    ["changed.ts", "sharedThing narrowThing"],
    ["reader.ts", "sharedThing narrowThing"],
    ["stranger.ts", "sharedThing"],
    ...everywhere,
  ];
}

test("the file the diff changed is not reported as its own reader", () => {
  const { reachable } = rank({
    files: fixture(),
    touched: new Set(["changed.ts"]),
    wanted: new Set(["sharedThing", "narrowThing"]),
  });
  assert.equal(reachable.some((hit) => hit.path === "changed.ts"), false);
});

test("an identifier past the cutoff points nowhere, so sharing only it is not a hit", () => {
  const { cutoff, reachable } = rank({
    files: fixture(),
    touched: new Set(["changed.ts"]),
    wanted: new Set(["sharedThing", "narrowThing"]),
  });
  assert.ok(cutoff < 500);
  assert.deepEqual(
    reachable.map((hit) => hit.path),
    ["reader.ts"],
  );
  assert.deepEqual(reachable[0].shared, ["narrowThing"]);
});

test("the rarest shared identifier is named first — it is why the file is on the list", () => {
  const files = [
    ["changed.ts", "wideThing narrowThing"],
    ["reader.ts", "wideThing narrowThing"],
    // Six files hold `wideThing` and two hold `narrowThing` — both under the cutoff, so the
    // ordering rather than the cutoff is what this measures.
    ...Array.from({ length: 4 }, (_, i) => [`other${i}.ts`, "wideThing"]),
    ...Array.from({ length: 5 }, (_, i) => [`quiet${i}.ts`, "nothingShared"]),
  ];
  const { reachable } = rank({
    files,
    touched: new Set(["changed.ts"]),
    wanted: new Set(["wideThing", "narrowThing"]),
  });
  assert.deepEqual(reachable[0].shared, ["narrowThing", "wideThing"]);
});
