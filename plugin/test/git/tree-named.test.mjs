/* The tree a git command runs in, which bash-guard reads: placed against the event's cwd. */
import assert from "node:assert/strict";
import test from "node:test";

import { NOWHERE } from "../../src/hooks/shell-spans.mjs";
import { treeNamed } from "../../src/git/tree-named.mjs";

test("a tree the shell stands nowhere in is named only by an absolute -C", () => {
  assert.equal(treeNamed(NOWHERE, "/b"), "/b");
  assert.equal(treeNamed(NOWHERE, "b"), NOWHERE);
  assert.equal(treeNamed(NOWHERE, null, "/base"), NOWHERE);
});

test("placed against a base, the move and then the -C are taken from it", () => {
  assert.equal(treeNamed(null, null, "/base"), "/base");
  assert.equal(treeNamed("a", "b", "/base"), "/base/a/b");
  assert.equal(treeNamed("/a", "/b", "/base"), "/b");
});

test("unplaced, what the text spells comes back as spelled, a relative pair joined", () => {
  assert.equal(treeNamed(null, null), null);
  assert.equal(treeNamed("a", null), "a");
  assert.equal(treeNamed(null, "b"), "b");
  assert.equal(treeNamed("/a", "b"), "/a/b");
  assert.equal(treeNamed("a", "b"), "a/b", "never this process's cwd, which is not the event's");
});
