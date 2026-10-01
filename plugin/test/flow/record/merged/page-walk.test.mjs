/* The merged mark is read off a comment page by several clause readers, and `verdictHeads` asks four of
   them for every issue `forge spec --status` reads. One page is walked once whichever reader asks, and
   a page that gained a mark since is read again rather than answered from the first walk (ISS-1843). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("merged-page-walk").path;
const { lastMark, verdictHeads } = await import("../../../../src/flow/record/merged.mjs");

const LANDED = "a".repeat(40);
const JUDGED = "b".repeat(40);
const NOTE = `mark_merged target=base — at ${LANDED}; judged head ${JUDGED}; landing moved nothing`;

/* A comment whose body counts every read of it, which is what a walk of the page costs. */
const counted = (body) => {
  const one = { reads: 0 };
  Object.defineProperty(one, "body", { get: () => { one.reads += 1; return body; }, enumerable: true });
  return one;
};

test("verdictHeads walks one page once, however many clauses it reads", () => {
  const page = [counted("a comment"), counted(NOTE), counted("another comment")];
  assert.deepEqual(verdictHeads(page), [LANDED, JUDGED]);
  assert.deepEqual(page.map((one) => one.reads), [1, 1, 1], "each body is read by one walk");
});

test("a page that gained a mark after it was read answers with the new one", () => {
  const page = [counted(NOTE)];
  assert.equal(lastMark(page), NOTE);
  const again = `mark_merged target=base — at ${"c".repeat(40)}; judged head ${JUDGED}; landing moved nothing`;
  page.push(counted(again));
  assert.equal(lastMark(page), again);
  assert.deepEqual(verdictHeads(page), ["c".repeat(40), JUDGED]);
});

test("no page reads as no mark", () => {
  assert.equal(lastMark(null), null);
  assert.equal(lastMark(undefined), null);
  assert.deepEqual(verdictHeads(null), []);
});
