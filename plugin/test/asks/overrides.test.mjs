/* The owner's seven documented overrides are a fixed corpus: each is the owner's whatever it declares. */
import assert from "node:assert/strict";
import test from "node:test";

import { OWNER_OVERRIDES } from "./owner-overrides.mjs";
import { ownerCategories, ownersBefore } from "../../src/asks/declared.mjs";

test("every question of the override corpus is the owner's even when it declares a reversal", () => {
  assert.equal(OWNER_OVERRIDES.length, 7);
  for (const one of OWNER_OVERRIDES) {
    const declared = { ...one, question: `${one.question} [reversible: choose the other option again]` };
    assert.match(String(ownersBefore(declared, ownerCategories([]))), /^it names /u, one.question);
  }
});
