/* What a worktree borrows from the checkout, and the read-back between writing a link and calling it
   made: `symlinkSync` returned without throwing on this repository's own volume and left a reparse
   point the kernel could not follow, so the tree was granted and its gate died on `eslint: not found`
   (ISS-883). Every case below that hands `borrowed` a writer of its own is that filesystem: no real
   one produces a write that succeeds and leaves nothing resolving, so the checker could not
   otherwise be watched to fire. `start.test.mjs` holds the grant's other halves. */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync,
  writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BARE, committed, git, OWN_SLUG, runIn, scratch } from "../run-fixtures.mjs";
import { borrowed, borrowedInto, BROKEN } from "../../../../tools/run/workspace/links.mjs";
import { relink } from "../../../../tools/run/workspace/relink.mjs";
import { start } from "../../../../tools/run/workspace/start.mjs";
import { Stop } from "../../../../tools/checkout.mjs";

const BOTH = ["node_modules", join("packages", "code-quality", "node_modules")];

const SELF = "node tools/run.mjs";

/** A scratch checkout holding both of the paths a worktree borrows, so a case reads about links
 *  rather than about a dependency the fixture never installed. */
const checkout = (name) => {
  const room = scratch(name);
  for (const one of BOTH) mkdirSync(join(room.work, one), { recursive: true });
  writeFileSync(join(room.work, "node_modules", "marker.txt"), "the checkout's own\n");
  /* Tracked, as the repository's own is: a worktree git checks out holds the borrowed path's parent
     directory, and one that does not is a tree missing tracked files rather than a link to repair. */
  writeFileSync(join(room.work, "packages", "code-quality", "package.json"), "{}\n");
  git(room.work, "init", "-b", "master");
  committed(room.work, "one");
  git(room.work, "add", join("packages", "code-quality", "package.json"));
  git(room.work, "commit", "-m", "the package a worktree borrows an install for");
  return room;
};

const treeOf = (work, key) => join(dirname(work), `wt-${OWN_SLUG}-${key}`);

/** A worktree with nothing linked into it, cut by git rather than by `start`, so a case about the
 *  repair does not depend on the grant it is the counterpart of. */
const cut = (work, key) => {
  const tree = treeOf(work, key);
  git(work, "worktree", "add", tree, "-b", `iss-${key.slice(4)}`);
  return tree;
};

const writesNothing = () => undefined;

test("a borrowed path is made and reads back as the checkout's own", () => {
  const { work } = checkout("borrowed-made");
  const tree = cut(work, "ISS-101");
  const [first] = borrowedInto(work, tree);
  assert.equal(first.kind, "made", first.said);
  assert.equal(realpathSync(join(tree, "node_modules")), realpathSync(join(work, "node_modules")));
  assert.equal(readFileSync(join(tree, "node_modules", "marker.txt"), "utf8"), "the checkout's own\n");
});

/* The case the read-back exists for, and the one that goes red without it: the write returns, the
   path does not resolve, and nothing between the grant and the first gate step says so. */
test("a write that returns and leaves nothing resolving is unresolved, not made", () => {
  const { work } = checkout("borrowed-unresolved");
  const tree = cut(work, "ISS-102");
  const one = borrowed(work, tree, "node_modules", writesNothing);
  assert.equal(one.kind, "unresolved", one.said);
  assert.ok(BROKEN.has(one.kind), "a path that does not resolve is not counted as broken");
  assert.ok(one.said.includes(join(tree, "node_modules")), `the path is not named:\n${one.said}`);
  assert.ok(one.said.includes(join(work, "node_modules")), `the target it was pointed at is not named:\n${one.said}`);
  assert.match(one.said, /does not resolve to it: /u, `what it read back as is not named:\n${one.said}`);
});

test("a path already resolving to its own target is kept, and nothing is written for it", () => {
  const { work } = checkout("borrowed-kept");
  const tree = cut(work, "ISS-103");
  borrowedInto(work, tree);
  let wrote = 0;
  const again = borrowed(work, tree, "node_modules", () => {
    wrote += 1;
  });
  assert.equal(again.kind, "kept", again.said);
  assert.equal(wrote, 0, "a link that already resolves to its own target was written again");
});

/* Resolving somewhere is not resolving to the checkout: a link left pointing at a second install
   reads as present and runs the wrong dependencies, which `existsSync` cannot tell from the right ones. */
test("a path resolving to another install is remade, not kept", () => {
  const { at, work } = checkout("borrowed-elsewhere");
  const other = join(at, "somebody-elses-install");
  mkdirSync(other, { recursive: true });
  const tree = cut(work, "ISS-104");
  symlinkSync(other, join(tree, "node_modules"));

  const one = borrowed(work, tree, "node_modules");
  assert.equal(one.kind, "made", one.said);
  assert.equal(realpathSync(join(tree, "node_modules")), realpathSync(join(work, "node_modules")));
});

test("a real directory at a borrowed path is left where it is, with what is in it", () => {
  const { work } = checkout("borrowed-occupied");
  const tree = cut(work, "ISS-105");
  const at = join(tree, "node_modules");
  mkdirSync(at, { recursive: true });
  writeFileSync(join(at, "somebody-installed-this.txt"), "mine\n");

  const one = borrowed(work, tree, "node_modules");
  assert.equal(one.kind, "occupied", one.said);
  assert.ok(BROKEN.has(one.kind), "a borrowed path this could not write is not counted as broken");
  assert.ok(lstatSync(at).isDirectory(), "the directory was replaced by a link");
  assert.equal(readFileSync(join(at, "somebody-installed-this.txt"), "utf8"), "mine\n");
});

/* `existsSync` answers no for a dangling link as it does for nothing at all, so the leftover this is
   about is read with `lstatSync`: a link to a target the checkout stopped holding is a path the tree
   still resolves through, and the arm that links nothing is the one that has to take it away. */
test("a target the checkout does not hold is reported, and no link is left at that path", () => {
  const { at, work } = checkout("borrowed-absent");
  const borrow = join("packages", "code-quality", "node_modules");
  const tree = cut(work, "ISS-106");
  const other = join(at, "somebody-elses-install");
  mkdirSync(other, { recursive: true });

  for (const left of [join(work, borrow), other]) {
    borrowedInto(work, tree);
    rmSync(join(tree, borrow), { force: true });
    symlinkSync(left, join(tree, borrow));
    rmSync(join(work, borrow), { recursive: true, force: true });

    const one = borrowed(work, tree, borrow);
    assert.equal(one.kind, "absent", one.said);
    assert.ok(!BROKEN.has(one.kind), "a dependency the checkout never installed is read as a broken link");
    assert.throws(() => lstatSync(join(tree, borrow)), { code: "ENOENT" },
      `a link to ${left} was left standing where the checkout holds no target for it`);
    mkdirSync(join(work, borrow), { recursive: true });
  }
});

/* The grant's half: what `start` does with a link it cannot read back. Called in process, the writer
   being the only way to ask a filesystem for the failure this is about. */
test("start unwinds the whole grant where a link it made does not read back", () => {
  const { work } = checkout("start-unwinds");
  const tree = treeOf(work, "ISS-107");
  let said = "nothing was thrown at all";
  assert.throws(() => start({ words: ["ISS-107"] }, { here: work, self: SELF, write: writesNothing }),
    (error) => {
      said = error.message;
      return error instanceof Stop;
    });

  assert.ok(!existsSync(tree), `the worktree was left standing:\n${said}`);
  assert.equal(git(work, "branch", "--list", "iss-107").stdout.trim(), "",
    `the branch the grant cut was left behind:\n${said}`);
  assert.ok(said.includes(join(tree, "node_modules")), `the path that would not link is not named:\n${said}`);
  assert.ok(said.includes(join(work, "node_modules")), `the target it was pointed at is not named:\n${said}`);
  assert.match(said, /resolving it raised/u, `what the path read back as is not named:\n${said}`);
  assert.ok(said.includes(`${SELF} start ISS-107`), `the call that clears it is not named:\n${said}`);
});

/* The refusal's other half: the write returned and left something, and what it left is not what the
   grant was pointed at. A tree resolving through a second install runs the wrong dependencies. */
test("start unwinds the grant where the link it made resolves to some other install", () => {
  const { at, work } = checkout("start-elsewhere");
  const other = join(at, "somebody-elses-install");
  mkdirSync(other, { recursive: true });
  const tree = treeOf(work, "ISS-114");
  let said = "nothing was thrown at all";
  assert.throws(() => start({ words: ["ISS-114"] },
    { here: work, self: SELF, write: (target, path) => symlinkSync(other, path) }),
  (error) => {
    said = error.message;
    return error instanceof Stop;
  });

  assert.ok(!existsSync(tree), `the worktree was left standing:\n${said}`);
  assert.ok(said.includes(realpathSync(other)), `where the link went instead is not named:\n${said}`);
});

test("start prints linked for a path it read back, and names the call that puts it back later", () => {
  const { work } = checkout("start-links");
  const tree = treeOf(work, "ISS-115");
  const run = spoken(() => start({ words: ["ISS-115"] }, { here: work, self: SELF }));
  for (const one of BOTH) {
    assert.ok(run.said.includes(`linked  ${join(tree, one)}`), `${one} is not reported as linked:\n${run.said}`);
    assert.equal(realpathSync(join(tree, one)), realpathSync(join(work, one)));
  }
  assert.ok(run.said.includes(`${join(tree, "tools", "run.mjs")} relink`),
    `the route back is not named where the links are:\n${run.said}`);
});

/* In process, the writer being the only way to ask for a write that returns and leaves nothing, and
   `process.exitCode` being the runner's own as much as the verb's. */
const spoken = (run) => {
  const said = [];
  const out = console.log;
  const err = console.error;
  const was = process.exitCode;
  console.log = (one) => said.push(one);
  console.error = (one) => said.push(one);
  try {
    run();
  } finally {
    console.log = out;
    console.error = err;
  }
  const code = process.exitCode;
  process.exitCode = was;
  return { said: said.join("\n"), code };
};

test("relink puts back both of a cut tree's links, and says what it did to each", () => {
  const { work } = checkout("relink-repairs");
  const tree = cut(work, "ISS-108");
  for (const one of BOTH) symlinkSync(join(work, "nothing-is-here"), join(tree, one));

  const run = runIn(tree, ["relink"], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  for (const one of BOTH) {
    assert.equal(realpathSync(join(tree, one)), realpathSync(join(work, one)), `${one} was not put back`);
    assert.ok(run.stdout.includes(`relinked  ${join(tree, one)}`), `${one} is not reported as relinked:\n${run.stdout}`);
  }

  const again = runIn(tree, ["relink"], BARE);
  assert.equal(again.status, 0, again.stderr + again.stdout);
  assert.equal((again.stdout.match(/^ {2}kept {6}/gmu) ?? []).length, BOTH.length,
    `a second call did not read both paths as kept:\n${again.stdout}`);
});

/* The whole point of a repair rather than a re-grant: `start` refuses a tree it did not make because
   that tree holds work, so the verb that does touch it may not cost any of it. */
test("relink removes neither the tree, its branch, nor the work standing in it", () => {
  const { work } = checkout("relink-keeps");
  const tree = cut(work, "ISS-109");
  rmSync(join(tree, "node_modules"), { force: true });
  writeFileSync(join(tree, "half-a-change.md"), "not committed\n");

  const run = runIn(tree, ["relink"], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal(readFileSync(join(tree, "half-a-change.md"), "utf8"), "not committed\n");
  assert.equal(git(tree, "rev-parse", "--abbrev-ref", "HEAD").stdout.trim(), "iss-109");
  assert.ok(git(work, "worktree", "list").stdout.includes(tree), "the tree is no longer registered");
});

test("relink from the checkout's own copy refuses, and names the checkout", () => {
  const { work } = checkout("relink-in-checkout");
  const run = runIn(work, ["relink"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`${work} is the checkout`), `the refusal does not name it:\n${run.stderr}`);
  assert.ok(lstatSync(join(work, "node_modules")).isDirectory(),
    "the checkout's own install was written over by a call meant for a worktree");
});

test("relink exits non-zero and names the path where one it could not write is left", () => {
  const { work } = checkout("relink-refuses");
  const tree = cut(work, "ISS-110");
  const at = join(tree, "node_modules");
  mkdirSync(at, { recursive: true });

  const run = runIn(tree, ["relink"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stdout.includes(`left      ${at}`), `the path it left is not named:\n${run.stdout}`);
  assert.match(run.stderr, /1 borrowed path\(s\) still do not resolve/u, run.stderr);
  assert.match(run.stderr, /are where they were/u,
    `the refusal does not say the tree survived it:\n${run.stderr}`);
});

/* One operation for both verbs, which is ISS-884's rule read as code: a second `symlinkSync` in
   either of them is a second write with a read-back of its own to forget. */
test("the grant and the repair make a link through one operation and neither writes its own", () => {
  for (const one of ["start.mjs", "relink.mjs"]) {
    const source = readFileSync(join(import.meta.dirname, "../../../../tools/run/workspace", one), "utf8");
    assert.match(source, /from "\.\/links\.mjs"/u, `${one} does not take its links from links.mjs`);
    assert.doesNotMatch(source, /symlinkSync/u, `${one} writes a link of its own, past the read-back`);
  }
});

/* The repair's own half of the read-back: a write that returns and leaves nothing is `start`'s
   unwind and `relink`'s refusal, and only the first of the two is reachable from a subprocess. */
test("relink names a path it wrote and could not read back, and takes nothing to find out", () => {
  const { work } = checkout("relink-unresolved");
  const tree = cut(work, "ISS-111");
  writeFileSync(join(tree, "half-a-change.md"), "not committed\n");

  const run = spoken(() => relink({}, { here: tree, write: writesNothing }));
  assert.equal(run.code, 1, run.said);
  for (const one of BOTH) {
    assert.ok(run.said.includes(`broken    ${join(tree, one)}`), `${one} is not named as broken:\n${run.said}`);
  }
  assert.match(run.said, /2 borrowed path\(s\) still do not resolve/u, run.said);
  assert.equal(readFileSync(join(tree, "half-a-change.md"), "utf8"), "not committed\n");
  assert.equal(git(tree, "rev-parse", "--abbrev-ref", "HEAD").stdout.trim(), "iss-111");
  assert.ok(git(work, "worktree", "list").stdout.includes(tree), "the tree is no longer registered");
});

/* The absent arm's own removal is the only place this code takes something nobody asked it to, so
   the reading behind it is not allowed to guess: a path it cannot read is not a path with nothing
   at it. `lstatSync` raises EACCES under a parent this process may not search. */
test("a borrowed path that cannot be read is said so, and nothing is taken on the guess", (t) => {
  if (process.getuid?.() === 0) return t.skip("root searches a directory whose mode forbids it");
  const { work } = checkout("borrowed-unreadable");
  const borrow = join("packages", "code-quality", "node_modules");
  const tree = cut(work, "ISS-116");
  borrowedInto(work, tree);
  rmSync(join(work, borrow), { recursive: true, force: true });
  const parent = join(tree, "packages", "code-quality");

  chmodSync(parent, 0o600);
  let one = null;
  try {
    one = borrowed(work, tree, borrow);
  } finally {
    chmodSync(parent, 0o755);
  }
  assert.equal(one.kind, "unresolved", one.said);
  assert.ok(BROKEN.has(one.kind), "a path nothing could read is not counted as broken");
  assert.ok(one.said.includes(join(tree, borrow)), `the path that could not be read is not named:\n${one.said}`);
  return assert.ok(lstatSync(join(tree, borrow)).isSymbolicLink(),
    "a link nothing could read was removed on the guess that nothing was there");
});

test("relink says of a target the checkout does not hold what start says, and leaves no link for it", () => {
  const { work } = checkout("relink-absent");
  const borrow = join("packages", "code-quality", "node_modules");
  const tree = cut(work, "ISS-117");
  borrowedInto(work, tree);
  rmSync(join(work, borrow), { recursive: true, force: true });

  const run = spoken(() => relink({}, { here: tree }));
  assert.ok(!run.code, `a target the checkout never installed is read as a failure:\n${run.said}`);
  assert.ok(run.said.includes(`left      ${borrow} is not installed in the checkout`),
    `the skipped path is not reported:\n${run.said}`);
  assert.ok(run.said.includes(`the link an earlier call left at ${join(tree, borrow)} is removed`),
    `the link left over that path is not reported as taken away:\n${run.said}`);
  assert.match(run.said, /the checkout's to install and nobody's to link/u,
    `the closing line still claims every path resolves:\n${run.said}`);
  assert.throws(() => lstatSync(join(tree, borrow)), { code: "ENOENT" });
});
