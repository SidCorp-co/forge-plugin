/* The table is one constant or it is two: the help prints from it, the fold refuses what it does
   not hold, and the window's width is derived from the band rather than chosen. */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULTS, bandSpread, foldWeights, weightLines } from "../../src/rank/weights.mjs";

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
    [{ band: { xs: null } }, /number of points/u],
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
   come off the band and not out of a developer's head. */
test("the window's width is the band's own spread", () => {
  assert.equal(bandSpread(DEFAULTS), 8, "xs 8 down to xl 0");
  assert.equal(bandSpread(foldWeights({ band: { xs: 20 } }).value), 20);
});

test("the help prints the table it scores with, not a copy of it", () => {
  const lines = weightLines(foldWeights({ priority: { critical: 99 }, batchCap: 9 }).value).join("\n");
  assert.match(lines, /critical 99/u, "the overridden weight, not the default");
  assert.match(lines, /9 members/u);
  for (const name of Object.keys(DEFAULTS)) {
    assert.ok(lines.includes(name), `${name} is a weight and no line of the help names it`);
  }
});
