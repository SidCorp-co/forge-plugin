/* A standing count is only a ratchet if nothing raises it: the checkers hold the tree to the number,
   and this holds the number to the default branch's (ISS-2502). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CONFIG, STANDING, raisedCounts, standingOf, standingProblems } from "../../../plugin/src/checks/shapes/standing.mjs";
import { defaultBranch, gitOut, remoteRef } from "../../checkout.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
const KEYS = ["vacuousAssertions", "sourcePins", "testOnlyExports"];

const config = (held) => ({ [STANDING]: held });

test("no standing count is higher than the default branch holds", (t) => {
  const now = JSON.parse(readFileSync(join(ROOT, CONFIG), "utf8"));
  for (const key of KEYS) assert.equal(typeof standingOf(now, key), "number", `${key} has a count`);
  let branch = null;
  try {
    branch = defaultBranch(ROOT);
  } catch (error) {
    t.skip(`no default branch resolves here, so there is no count to compare with: ${error.message}`);
    return;
  }
  const base = gitOut(["merge-base", "HEAD", remoteRef(branch)], ROOT) ?? gitOut(["merge-base", "HEAD", branch], ROOT);
  const held = base === null ? null : gitOut(["show", `${base}:${CONFIG}`], ROOT);
  if (held === null) {
    t.skip(`HEAD has no merge base with ${branch} holding ${CONFIG}, so there is no count to compare with`);
    return;
  }
  assert.deepEqual(raisedCounts(now, JSON.parse(held)), []);
});

test("a raised count is named with the number to put back, and a lowered or a new one is not", () => {
  const said = raisedCounts(config({ a: 5, b: 2, c: 9 }), config({ a: 4, b: 3 }));
  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /^`standing\.a` in package\.json is 5 where the default branch holds 4\./u);
  assert.match(said[0], /put back 4 and fix the finding the checker names instead/u);
});

test("a tree at its count owes nothing, above it lists every finding, and below it names the count to write", () => {
  assert.deepEqual(standingProblems({ key: "k", problems: ["one", "two"], standing: 2 }), []);
  const above = standingProblems({ key: "k", problems: ["one", "two", "three"], standing: 2 });
  assert.match(above[0], /^3 finding\(s\) where `standing\.k` in package\.json stands at 2\. The count may only fall/u);
  assert.deepEqual(above.slice(1), ["one", "two", "three"]);
  const below = standingProblems({ key: "k", problems: ["one"], standing: 2 });
  assert.equal(below.length, 1);
  assert.match(below[0], /this tree holds fewer, so write 1 there/u);
});

test("a checker with no whole-number count is refused with the key to write", () => {
  assert.equal(standingOf(config({ k: 0 }), "k"), 0);
  assert.throws(() => standingOf(config({}), "k"), /package\.json holds no count at `standing\.k` \(it reads undefined\)/u);
  assert.throws(() => standingOf(config({ k: 1.5 }), "k"), /Write the number of findings the tree holds today there/u);
});
