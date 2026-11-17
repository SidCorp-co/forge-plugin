import assert from "node:assert/strict";
import { test } from "node:test";

import { ROUTES } from "../../../src/tracker/routes.mjs";
import { undeclaredIn } from "../../../src/tracker/declared/no-route.mjs";

/* forge ISS-1256: memory search is the find door's memory filter, which ranks one way and reads
   curated memory alone. A strategy or a mirror source is refused before it leaves, on a core that
   would still take it as on one that refuses it. */
test("memory search refuses a strategy and a mirror source, and sends a curated one", () => {
  const row = ROUTES["forge_memory.search"];
  assert.deepEqual(undeclaredIn(row, { query: "q", strategy: "semantic" }), ["strategy"],
    "the door takes no strategy, so none is sent");
  assert.deepEqual(undeclaredIn(row, { query: "q", sourceFilter: ["issue"] }), ["sourceFilter: issue"],
    "an issue copy is the door's issue type, never a memory source");
  assert.deepEqual(undeclaredIn(row, { query: "q", topK: 5, sourceFilter: ["note", "decision"] }), [],
    "a curated source is still a narrowing the route sends");
});
