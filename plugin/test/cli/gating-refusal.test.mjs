/* What counts as the tracker saying no: a dropped socket read as a refusal hides a verb from every
   run until the next probe, and a refusal read as a fault of the moment offers a call nothing makes. */
import assert from "node:assert/strict";
import test from "node:test";

import { gatingRefusal } from "../../src/tools/doctor.mjs";

test("a refusal that is not one saying no gates nothing, whether the row names one or not", () => {
  assert.match(gatingRefusal({ refused: "set_dependency has no route\nand a second line" }), /has no route/u);
  for (const refused of [
    "Forge did not answer POST /api/projects/x/pm: socket hang up",
    "BAD_REQUEST: fromIssueId is required",
    "Forge did not answer GET /api/projects/x/knowledge: fetch failed",
    "Forge answered 503 for GET /api/guides",
  ]) {
    assert.equal(gatingRefusal({ refused }), null,
      `${refused}: a row naming no refusal is not gated by a fault of the moment, and four of the five name none`);
  }
  assert.equal(gatingRefusal({ nodes: [] }), null, "and an answer gates nothing at all");
  assert.match(gatingRefusal({ refused: "FORBIDDEN: knowledge is not enabled" }), /FORBIDDEN/u,
    "while the tracker saying no is what a capability record is for");
});
