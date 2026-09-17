/* The tree a relatedness reason is read against: what it holds, what it refuses to answer for, and
   what a place git answers for nothing does to the reading. */
import assert from "node:assert/strict";
import test from "node:test";

import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { resolverIn, treeAt } from "../../src/rank/checkout.mjs";
import { tempRoom } from "../fixtures.mjs";

const repo = () => {
  const room = tempRoom("rank-checkout-");
  spawnSync("git", ["-C", room, "init", "-q"], { cwd: room, encoding: "utf8" });
  mkdirSync(join(room, "plugin/src/rank"), { recursive: true });
  writeFileSync(join(room, "plugin/src/rank/batch.mjs"), "");
  return room;
};

test("a path the tree holds resolves, and one it has never held does not", () => {
  const resolves = resolverIn(treeAt(repo()));
  assert.equal(resolves("plugin/src/rank/batch.mjs"), true);
  assert.equal(resolves("plugin/src/rank"), true, "a tree a body names is a path like any other");
  assert.equal(resolves("plugin/src/tools/issues.mjs"), false);
});

/* A body is free to carry either, and this tree cannot answer for what is outside it. */
test("an absolute path and one climbing out of the root are absent rather than read elsewhere", () => {
  const resolves = resolverIn(treeAt(repo()));
  assert.equal(resolves("/etc/hosts"), false);
  assert.equal(resolves("../../etc/hosts"), false);
});

/* A lexical prefix passes for a link that points away, and existence then follows it (F1, ISS-1363). */
test("a path reaching outside the tree through a symlink is absent, and one staying inside is held", () => {
  const room = repo();
  const away = tempRoom("rank-elsewhere-");
  writeFileSync(join(away, "file.mjs"), "");
  symlinkSync(away, join(room, "plugin/shared"));
  symlinkSync(join(room, "plugin/src/rank"), join(room, "plugin/here"));
  const resolves = resolverIn(treeAt(room));
  assert.equal(resolves("plugin/shared/file.mjs"), false, "it resolves in somebody else's directory");
  assert.equal(resolves("plugin/here/batch.mjs"), true, "a link that stays inside still names this tree");
});

test("where git answers for nothing, no path is refused", () => {
  const room = tempRoom("rank-no-tree-");
  assert.equal(treeAt(room), null);
  assert.equal(resolverIn(null)("plugin/src/tools/issues.mjs"), true);
});
