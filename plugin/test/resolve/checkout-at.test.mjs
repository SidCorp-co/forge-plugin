/* The walk that replaced `git rev-parse --show-toplevel` and `--git-common-dir` (ISS-1732), read
   against real worktrees git made rather than a hand-built layout: `commondir` is the file the
   repository answer hangs off, and nothing but git writes it. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
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

/* Each answer is what `--show-toplevel`, `--git-dir` and `--git-common-dir` print in the same
   directory, so the walk is judged against git rather than against itself. */
const likeGit = (at) => {
  const found = checkoutAt(at);
  const asked = (...args) => git(at, "rev-parse", "--path-format=absolute", ...args).stdout.trim();
  assert.equal(found.tree, realpathSync(asked("--show-toplevel")), at);
  assert.equal(found.gitDir, asked("--git-dir"), at);
  assert.equal(found.repository, realpathSync(join(asked("--git-common-dir"), "..")), at);
};

test("every answer is the one git prints for the same directory", () => {
  for (const at of [rooms.main, rooms.nested, rooms.beside, join(rooms.main, "docs", "deep")]) likeGit(at);
});

/* An empty `.git` is not a git directory and git's discovery ascends past it, so a checkout holding
   one must not answer for itself — a project file would otherwise resolve from a directory that is
   no checkout. */
test("a .git directory git will not accept is ascended past, as git ascends past it", () => {
  const stub = join(rooms.main, "stub");
  mkdirSync(join(stub, ".git"), { recursive: true });
  assert.equal(checkoutAt(stub).tree, rooms.main);
  likeGit(stub);
});

/* git canonicalises the common directory, so a `commondir` naming a symlink must not put the
   repository beside the symlink: a worktree carrying no project file would lose its main checkout's. */
test("a commondir naming a symlink answers with the directory it points at, as git does", () => {
  const shared = join(rooms.room, "shared-git");
  symlinkSync(join(rooms.main, ".git"), shared);
  writeFileSync(join(rooms.main, ".git", "worktrees", "beside", "commondir"), `${shared}\n`);
  assert.equal(checkoutAt(rooms.beside).repository, rooms.main);
  likeGit(rooms.beside);
});
