/* The three counts a spend is judged by, in files. Every case here fails against a report that counts seconds,
   which every figure this family argued over was in and which a faster box shrinks without moving any waste (ISS-1746). */
import assert from "node:assert/strict";
import test from "node:test";

import { reachOf } from "../../../gates/report/reach.mjs";

const set = (over = {}) => ({ paths: [], dirs: [], trees: [], whole: [], ...over });

const over = (entries) => new Map(Object.entries(entries));

test("a file whose recorded set names a changed path outright is reached", () => {
  const closures = over({ "a.test.mjs": set({ paths: ["plugin/src/one.mjs"] }) });
  assert.deepEqual(reachOf(["a.test.mjs"], closures, ["plugin/src/one.mjs"]),
    { spent: 1, reached: 1, blind: 0, elsewhere: 0, past: 0 });
});

// A listing is a claim about the names in the directory, so a path arriving in it or leaving moves it.
test("a changed path in a directory the file listed is reached, and one a level below it is not", () => {
  const closures = over({ "a.test.mjs": set({ dirs: ["plugin/src"] }) });
  assert.equal(reachOf(["a.test.mjs"], closures, ["plugin/src/one.mjs"]).reached, 1);
  assert.equal(reachOf(["a.test.mjs"], closures, ["plugin/src/deep/one.mjs"]).reached, 0);
});

test("a recursive listing reaches every path below it, and the root is the tree whole", () => {
  assert.equal(reachOf(["a.test.mjs"], over({ "a.test.mjs": set({ trees: ["plugin"] }) }),
    ["plugin/src/deep/one.mjs"]).reached, 1);
  assert.equal(reachOf(["a.test.mjs"], over({ "a.test.mjs": set({ trees: ["."] }) }),
    ["tools/gates.mjs"]).reached, 1);
});

test("a file the record holds no set for is blind and never reached, which is the count that does not flatter", () => {
  assert.deepEqual(reachOf(["a.test.mjs"], new Map(), ["plugin/src/one.mjs"]),
    { spent: 1, reached: 0, blind: 1, elsewhere: 0, past: 0 });
});

// The narrowing answering for nothing: everything spent, one file reached, and before this count the run printed what it prints with nothing to hold back (ISS-1739).
test("a spend the change reaches no part of is the excess, and the excess is what is left over", () => {
  const closures = over({
    "a.test.mjs": set({ paths: ["plugin/src/one.mjs"] }),
    "b.test.mjs": set({ paths: ["plugin/src/two.mjs"] }),
    "c.test.mjs": set({ paths: ["plugin/src/three.mjs"] }),
  });
  assert.deepEqual(reachOf(["a.test.mjs", "b.test.mjs", "c.test.mjs", "d.test.mjs"], closures,
    ["plugin/src/one.mjs"]), { spent: 4, reached: 1, blind: 1, elsewhere: 0, past: 2 });
});

/* Why the excess is what neither count explains and never a measured waste: the set is the newest the record holds and
   answers for the content that recorded it, so a file since grown the very dependency this change touches counts in it. */
test("a set recorded before the file gained the dependency the change touches counts in the excess", () => {
  const closures = over({ "a.test.mjs": set({ paths: ["plugin/src/old.mjs"] }) });
  assert.deepEqual(reachOf(["a.test.mjs"], closures, ["plugin/src/new.mjs"]),
    { spent: 1, reached: 0, blind: 0, elsewhere: 0, past: 1 });
});

/* The one excess a run can prove: the set was recorded under another context, so it had no chance of matching whatever its
   content. A set older than this field is no evidence either way and stays in the residual, as an older entry reads. */
test("a file whose set was recorded under another context is counted as that, and one recorded under this one is not", () => {
  const here = "0123456789ab";
  const closures = over({
    "a.test.mjs": set({ paths: ["plugin/src/old.mjs"], context: "ffffffffffff" }),
    "b.test.mjs": set({ paths: ["plugin/src/old.mjs"], context: here }),
    "c.test.mjs": set({ paths: ["plugin/src/old.mjs"] }),
  });
  assert.deepEqual(reachOf(["a.test.mjs", "b.test.mjs", "c.test.mjs"], closures, ["plugin/src/new.mjs"], here),
    { spent: 3, reached: 0, blind: 0, elsewhere: 1, past: 2 });
});

test("a file the change reaches is reached however its set was keyed, having been owed the spend anyway", () => {
  const closures = over({ "a.test.mjs": set({ paths: ["plugin/src/one.mjs"], context: "ffffffffffff" }) });
  assert.deepEqual(reachOf(["a.test.mjs"], closures, ["plugin/src/one.mjs"], "0123456789ab"),
    { spent: 1, reached: 1, blind: 0, elsewhere: 0, past: 0 });
});

test("a run that spent nothing counts nothing, and its counts still add up", () => {
  assert.deepEqual(reachOf([], new Map(), ["plugin/src/one.mjs"]),
    { spent: 0, reached: 0, blind: 0, elsewhere: 0, past: 0 });
});
