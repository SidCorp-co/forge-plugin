/* ISS-364. The two answers three copies of this disagreed on — the empty set's and the even-length
   set's — pinned, because a contract stated only in prose moves with nothing going red. */
import assert from "node:assert/strict";
import test from "node:test";

import { median } from "../../src/stats/median.mjs";

test("an empty set has no median and says so, rather than answering nought", () => {
  assert.equal(median([]), null, "nought is a measurement and the absence of one is not");
});

test("an even-length set answers with the mean of its two middle values, not the upper of them", () => {
  assert.equal(median([1, 2]), 1.5);
  assert.equal(median([4, 1, 3, 2]), 2.5, "and the input is sorted first, whatever order it arrives in");
});

test("an odd-length set answers with its middle value", () => {
  assert.equal(median([1]), 1);
  assert.equal(median([80, 40, 60]), 60);
});

/* The comparator, not the default: under a lexicographic sort `[100, 9]` stays put, so a copy written without one answers 54.5 here too and only the three-value case tells them apart. */
test("the numbers are ordered as numbers, which two digits against one is what shows", () => {
  assert.equal(median([10, 9, 8]), 9);
  assert.equal(median([100, 9]), 54.5);
});

test("the caller's array is not reordered under it", () => {
  const given = [3, 1, 2];
  median(given);
  assert.deepEqual(given, [3, 1, 2]);
});
