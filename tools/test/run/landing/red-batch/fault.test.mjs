/* Whose a red candidate is, on readings alone: which member each failing case's paths reach, and
   what sends a set to splitting instead of naming anybody (ISS-2480). */
import assert from "node:assert/strict";
import test from "node:test";

import { attributed, casesOf } from "../../../../run/land-ready/fault.mjs";

const member = (key, ...files) => ({ key, landing: { files } });
const ONE = member("ISS-1", "plugin/src/one.mjs");
const TWO = member("ISS-2", "docs/two.md", "plugin/hooks/how/code-quality.md");
const THREE = member("ISS-3", "plugin/test/three.test.mjs");
const SET = [ONE, TWO, THREE];
const keys = (members) => members.map((one) => one.key);
const culprits = (fall) => (fall.culprits ?? []).map(({ member: one }) => one.key);
const FILE = "plugin/test/hooks/hook-how.test.mjs";
const read = (paths, { dirs = [], trees = [], whole = [] } = {}) => ({ paths, dirs, trees, whole });
const testVerdict = (reads) => ({ step: "test", cases: [{ file: FILE, name: "a how stays under its ceiling" }],
  reads: { [FILE]: reads } });

test("a lint step's path and line, printed absolute from the landing's room, names the member that wrote it", () => {
  const output = "=== lint ===\n/tmp/forge-landing-ab12/plugin/src/one.mjs\n  12:3  error  no-unused-vars\n";
  const fall = attributed(casesOf({ step: "lint" }, output), SET);
  assert.deepEqual(culprits(fall), ["ISS-1"]);
});

test("the dup step's path, relative to the directory it was pointed at, names the member that wrote it", () => {
  const output = "=== check:dup ===\n1.00  src/one.mjs\n        text\n      src/untouched.mjs\n        text\n";
  assert.deepEqual(culprits(attributed(casesOf({ step: "check:dup" }, output), SET)), ["ISS-1"]);
});

test("a path a step before the failing one printed is not read as the failing step's", () => {
  const output = "=== lint ===\nplugin/src/one.mjs:1 fine\n=== check:spec ===\ndocs/two.md:4 a citation is stale\n";
  assert.deepEqual(culprits(attributed(casesOf({ step: "check:spec" }, output), SET)), ["ISS-2"]);
});

test("a version number in the output is no path", () => {
  const output = "=== check:dup ===\n1.00  src/one.mjs\n3.36.341 is the release\n";
  assert.deepEqual(culprits(attributed(casesOf({ step: "check:dup" }, output), SET)), ["ISS-1"]);
});

test("a failing test case falls to the member whose path its file read", () => {
  const fall = attributed(casesOf(testVerdict(read([FILE, "plugin/hooks/how/code-quality.md"])), ""), SET);
  assert.deepEqual(culprits(fall), ["ISS-2"]);
  assert.match(fall.culprits[0].cases[0].what, /hook-how\.test\.mjs {2}a how stays under its ceiling/u);
});

test("a failing test file that is itself a member's own names that member", () => {
  const verdict = { step: "test", cases: [{ file: THREE.landing.files[0], name: "x" }],
    reads: { [THREE.landing.files[0]]: read([]) } };
  assert.deepEqual(culprits(attributed(casesOf(verdict, ""), SET)), ["ISS-3"]);
});

test("a directory the case listed or a tree it walked reaches every member file below it", () => {
  const listed = attributed(casesOf(testVerdict(read([FILE], { dirs: ["plugin/hooks/how"] })), ""), SET);
  assert.deepEqual(culprits(listed), ["ISS-2"]);
  const walked = attributed(casesOf(testVerdict(read([FILE], { trees: ["plugin/src", "docs"] })), ""), SET);
  assert.equal(walked.culprits, null, "trees over two members' paths name neither");
  assert.deepEqual(keys(walked.suspects), ["ISS-1", "ISS-2"]);
});

test("a case with no finished read record is attributed to nobody and every member is a suspect", () => {
  const fall = attributed(casesOf(testVerdict(null), ""), SET);
  assert.equal(fall.culprits, null);
  assert.deepEqual(keys(fall.suspects), keys(SET));
});

test("a test step that named no case, and a refusal that named no step, are attributed to nobody", () => {
  for (const verdict of [{ step: "test" }, null, {}]) {
    const fall = attributed(casesOf(verdict, "anything plugin/src/one.mjs"), SET);
    assert.equal(fall.culprits, null, JSON.stringify(verdict));
    assert.deepEqual(keys(fall.suspects), keys(SET));
  }
});

test("a failure that reaches no member's paths makes every member a suspect", () => {
  const fall = attributed(casesOf({ step: "lint" }, "=== lint ===\nplugin/src/untouched.mjs:1 error\n"), SET);
  assert.equal(fall.culprits, null);
  assert.deepEqual(keys(fall.suspects), keys(SET));
});

test("a failure that reaches two members makes those two the suspects and clears the third", () => {
  const output = "=== check:dup ===\n1.00  src/one.mjs\n      hooks/how/code-quality.md\n";
  const fall = attributed(casesOf({ step: "check:dup" }, output), SET);
  assert.equal(fall.culprits, null);
  assert.deepEqual(keys(fall.suspects), ["ISS-1", "ISS-2"]);
});

test("two cases each falling to one member name both, and one case of several undecided names neither", () => {
  const verdict = { step: "test",
    cases: [{ file: FILE, name: "a" }, { file: "plugin/test/b.test.mjs", name: "b" }],
    reads: { [FILE]: read([FILE, "docs/two.md"]), "plugin/test/b.test.mjs": read(["plugin/src/one.mjs"]) } };
  assert.deepEqual(culprits(attributed(casesOf(verdict, ""), SET)).sort(), ["ISS-1", "ISS-2"]);
  const blind = { ...verdict, reads: { ...verdict.reads, "plugin/test/b.test.mjs": null } };
  const fall = attributed(casesOf(blind, ""), SET);
  assert.equal(fall.culprits, null);
  assert.deepEqual(keys(fall.suspects), keys(SET));
});

/* The live batch of 2026-09-25: hook-how.test.mjs read 113 paths, four members' among them, and its
   assertion named the one document over its ceiling, which only ISS-676 had written. */
test("a failing case whose message names one of its reads falls to the member that wrote that read alone", () => {
  const verdict = { step: "test",
    cases: [{ file: FILE, name: "each document opens with its claim", said: [
      "how/code-quality.md is 1484 characters; the ceiling is 1300, and what does not fit is an argument"] }],
    reads: { [FILE]: read([FILE, "plugin/src/one.mjs", "docs/two.md", "plugin/hooks/how/code-quality.md"]) } };
  const fall = attributed(casesOf(verdict, ""), SET);
  assert.deepEqual(culprits(fall), ["ISS-2"]);
  assert.match(fall.culprits[0].cases[0].read, /the paths its failure named, how\/code-quality\.md/u);
});

test("a failure message naming nothing the case read leaves the case at everything it read", () => {
  const verdict = { step: "test",
    cases: [{ file: FILE, name: "x", said: ["plugin/src/one.mjs is fine, docs/elsewhere.md is not"] }],
    reads: { [FILE]: read([FILE, "docs/two.md", "plugin/src/untouched.mjs"]) } };
  assert.deepEqual(culprits(attributed(casesOf(verdict, ""), SET)), ["ISS-2"],
    "one.mjs was named and not read, so the read record decides");
});
