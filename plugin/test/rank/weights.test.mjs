/* The table is one constant or it is two: the help prints from it, the fold refuses what it does
   not hold, and the window's width is derived from the complexity's weights rather than chosen. */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULTS, canonicalKeys, complexitySpread, foldWeights, weightLines } from "../../src/rank/weights.mjs";

test("a project overrides one weight and keeps every other", () => {
  const { value, from, refusal } = foldWeights({ priority: { critical: 100 }, blocks: 7 });
  assert.equal(refusal, null);
  assert.equal(from, ".forge.json");
  assert.equal(value.priority.critical, 100, "the one it named");
  assert.equal(value.priority.high, DEFAULTS.priority.high, "and the rest of that table stands");
  assert.equal(value.blocks, 7);
  assert.equal(value.batchCap, DEFAULTS.batchCap);
});

test("a weight the table does not hold is refused, not dropped", () => {
  for (const [given, matching] of [
    [{ urgency: 4 }, /rank\.urgency/u],
    [{ priority: { urgent: 4 } }, /rank\.priority\.urgent/u],
    [{ priority: 40 }, /a table of/u],
    [{ blocks: "three" }, /is a number/u],
    [{ complexity: { xs: null } }, /number of points/u],
  ]) {
    const { refusal, value } = foldWeights(given);
    assert.match(refusal ?? "", matching, JSON.stringify(given));
    assert.deepEqual(value, DEFAULTS, "and nothing of the given object was folded in");
  }
});

test("no project object leaves the built-in table, and says so", () => {
  const held = foldWeights(null);
  assert.deepEqual(held.value, DEFAULTS);
  assert.equal(held.from, "the built-in table");
});

/* The window is what makes a bounded body read order as the whole list would, so the number has to
   come off the weights and not out of a developer's head. */
test("the window's width is the complexity weights' own spread", () => {
  assert.equal(complexitySpread(DEFAULTS), 8, "xs 8 down to xl 0");
  assert.equal(complexitySpread(foldWeights({ complexity: { xs: 20 } }).value), 20);
});

/* `rank.band` was the key while the CLI had two words for the tracker's field. A project that set it
   scores as it always did, and the run says which key it read: a weight taken off a key nobody
   printed is an order nobody can account for (ISS-822). */
test("the retired setting key scores as the canonical one and the run says which it read", () => {
  const retired = foldWeights({ band: { xs: 20, l: 3, xl: 1 } });
  const canonical = foldWeights({ complexity: { xs: 20, l: 3, xl: 1 } });
  assert.deepEqual(retired.value, canonical.value, "the same weights, whichever key carried them");
  assert.equal(retired.value.complexity.l, 3);
  assert.equal(retired.value.complexity.xl, 1, "and the two largest still score apart");
  assert.match(retired.said, /`rank\.band` is the retired spelling of `rank\.complexity`/u);
  assert.match(retired.said, /read as `rank\.complexity`/u, "and what to do about it");
  assert.equal(canonical.said, null, "while a project on the canonical key is told nothing");
});

test("both keys set is answered by name, the canonical one scoring", () => {
  const held = foldWeights({ band: { xs: 20 }, complexity: { xs: 7 } });
  assert.equal(held.value.complexity.xs, 7, "the canonical key decides");
  assert.match(held.said, /sets both/u);
  assert.match(held.said, /the score is on `rank\.complexity`/u);
  assert.deepEqual(canonicalKeys({ complexity: { xs: 7 } }).given, { complexity: { xs: 7 } },
    "and a project naming neither spelling is handed back what it wrote");
});

test("the help prints the table it scores with, not a copy of it", () => {
  const lines = weightLines(foldWeights({ priority: { critical: 99 }, batchCap: 9 }).value).join("\n");
  assert.match(lines, /critical 99/u, "the overridden weight, not the default");
  assert.match(lines, /9 members/u);
  for (const name of Object.keys(DEFAULTS)) {
    assert.ok(lines.includes(name), `${name} is a weight and no line of the help names it`);
  }
});
