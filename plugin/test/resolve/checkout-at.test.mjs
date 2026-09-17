/* The walk that replaced `git rev-parse --show-toplevel` and `--git-common-dir` (ISS-1732), read
   against real worktrees git made rather than a hand-built layout: `commondir` is the file the
   repository answer hangs off, and nothing but git writes it. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";

import { git, tempRoom } from "../fixtures.mjs";

import { checkoutAt } from "../../src/resolve/checkout-at.mjs";

const ran = (room, ...args) => {
  const done = git(room, ...args);
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
};

const built = () => {
  const room = realpathSync(tempRoom("checkout-at-"));
  const main = join(room, "main");
  mkdirSync(join(main, "docs", "deep"), { recursive: true });
  ran(main, "init", "-q", "-b", "master", ".");
  ran(main, "commit", "-q", "--allow-empty", "-m", "the first commit");
  const nested = join(main, "trees", "nested");
  const beside = join(room, "beside");
  ran(main, "worktree", "add", "-q", "-b", "nested", nested);
  ran(main, "worktree", "add", "-q", "-b", "beside", beside);
  mkdirSync(join(beside, "docs", "deep"), { recursive: true });
  return { room, main, nested, beside };
};

const rooms = built();

test("a linked worktree answers its own root as the tree and the main checkout as the repository", () => {
  for (const tree of [rooms.nested, rooms.beside]) {
    const found = checkoutAt(tree);
    assert.equal(found.tree, tree);
    assert.equal(found.repository, rooms.main);
  }
});

test("a subdirectory of a linked worktree answers that worktree, not the directory it was asked from", () => {
  const found = checkoutAt(join(rooms.beside, "docs", "deep"));
  assert.equal(found.tree, rooms.beside);
  assert.equal(found.repository, rooms.main);
});

test("a linked worktree's git directory is the admin directory its .git file names", () => {
  assert.equal(checkoutAt(rooms.nested).gitDir, join(rooms.main, ".git", "worktrees", "nested"));
});

test("an ordinary checkout answers itself as both its tree and its repository", () => {
  const found = checkoutAt(rooms.main);
  assert.equal(found.tree, rooms.main);
  assert.equal(found.repository, rooms.main);
  assert.equal(found.gitDir, join(rooms.main, ".git"));
});

test("a subdirectory of an ordinary checkout answers that checkout", () => {
  assert.equal(checkoutAt(join(rooms.main, "docs", "deep")).tree, rooms.main);
});

test("a directory no checkout holds answers null", () => {
  assert.equal(checkoutAt(realpathSync(tempRoom("checkout-at-none-"))), null);
});

/* Each of the two is what `--show-toplevel` and `--git-common-dir` printed in the same directory
   before this walk replaced them, so the walk is judged against git rather than against itself. */
test("both answers are the ones git prints for the same directory", () => {
  for (const at of [rooms.main, rooms.nested, rooms.beside, join(rooms.main, "docs", "deep")]) {
    const found = checkoutAt(at);
    const top = git(at, "rev-parse", "--show-toplevel");
    const shared = git(at, "rev-parse", "--path-format=absolute", "--git-common-dir");
    assert.equal(found.tree, realpathSync(top.stdout.trim()), at);
    assert.equal(found.repository, realpathSync(join(shared.stdout.trim(), "..")), at);
  }
});
