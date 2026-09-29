/* The tree a git command runs in, which two gates read: bash-guard placed against the event's cwd, and
   codex-second unplaced, placed by its caller. */
import assert from "node:assert/strict";
import test from "node:test";

import { NOWHERE } from "../../src/hooks/shell-spans.mjs";
import { treeNamed } from "../../src/hooks/tree-named.mjs";
import { commitAim } from "../../hooks/gates/codex/codex-second.mjs";

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

/* The defect the shared reading closed: a relative move and a relative -C were resolved against the
   hook process's cwd, so the caller's placement against the event's cwd came too late to count. */
test("a commit after a relative move with a relative -C is read without the hook's own cwd", () => {
  const aim = commitAim({ tool_name: "Bash", tool_input: { command: "cd b && git -C c commit -m x" }, cwd: "/elsewhere" });
  assert.equal(aim.tree, "b/c");
});
