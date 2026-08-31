import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_IGNORED_DIRECTORIES, walkDirectories } from "../src/walk.js";

function tree() {
  const root = mkdtempSync(path.join(tmpdir(), "cq-walk-"));
  for (const dir of ["a", "a/b", "node_modules", "worktrees", ".hidden", "pkg"]) {
    mkdirSync(path.join(root, dir), { recursive: true });
  }
  writeFileSync(path.join(root, "a/b/leaf.js"), "");
  writeFileSync(path.join(root, "pkg/eslint.config.js"), "");
  return root;
}

const namesUnder = (root, options) =>
  [...walkDirectories([root], options)].map(({ directory }) => path.relative(root, directory)).sort();

test("the ignore list and dot-directories are skipped, and nested directories are reached", () => {
  const root = tree();
  assert.deepEqual(namesUnder(root), ["", "a", path.join("a", "b"), "pkg"]);
  assert.equal(DEFAULT_IGNORED_DIRECTORIES.has("worktrees"), true);
});

test("descend stops the walk at what a caller was looking for", () => {
  const root = tree();
  const stoppedAtA = namesUnder(root, { descend: (child) => path.basename(child) !== "a" });
  assert.deepEqual(stoppedAtA, ["", "pkg"]);
});

test("a symlinked directory is never descended, so a loop cannot hang the walk", () => {
  const root = tree();
  symlinkSync(root, path.join(root, "a", "loop"));
  assert.deepEqual(namesUnder(root), ["", "a", path.join("a", "b"), "pkg"]);
});

test("an unreadable directory is skipped rather than thrown from", () => {
  assert.deepEqual([...walkDirectories([path.join(tmpdir(), "cq-walk-absent")])], []);
});
