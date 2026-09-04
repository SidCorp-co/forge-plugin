/* What a commit closes over, read from the command alone — the answers the gate then decides on. */
import assert from "node:assert/strict";
import test from "node:test";

import { NOWHERE, committing } from "../../hooks/_hook.mjs";
import { commitAim } from "../../hooks/gates/codex-second.mjs";

/* Command position, and git's globals take arguments: `--git-dir /r/.git commit` is one. */
const ev = (command) => ({ tool_name: "Bash", tool_input: { command } });
test("a commit behind a quoted global with a space is a commit in that tree", () => {
  assert.equal(committing(ev(`git -C "/tmp/a b" commit -m x`)), true);
  assert.equal(committing(ev(`git --no-pager -C '/tmp/a b' commit -m x`)), true);
  assert.equal(commitAim(ev(`git -C "/tmp/a b" commit -m x`)).tree, "/tmp/a b");
  assert.equal(commitAim(ev("git --work-tree /w --git-dir /m/repo.git commit -m x")).tree, "/w", "the work tree, not the last option");
  assert.equal(commitAim(ev("git --git-dir /w/.git commit -m x")).tree, "/w");
});

/* An agent whose shell resets its cwd commits into a worktree by moving there first, and a move the
   commit never inherited — a subshell's, or one made after it — is not the tree it closes in. */
test("the tree a commit closes in is the last move it inherited", () => {
  assert.equal(commitAim(ev("cd /w && git commit -m x")).tree, "/w");
  assert.equal(commitAim(ev("cd /w; git commit -m x")).tree, "/w");
  assert.equal(commitAim(ev("cd /a && cd b && git commit -m x")).tree, "/a/b", "two relative moves compose");
  assert.equal(commitAim(ev("(cd /a && true); git commit -m x")).tree, null, "a subshell's move dies with it");
  /* The walk stops before the commit's own span, so a commit inside the subshell keeps the move. */
  assert.equal(commitAim(ev("(cd /a && git commit -m x)")).tree, "/a", "a commit inside it does not");
  assert.equal(commitAim(ev("(cd /a; git commit -m x)")).tree, "/a");
  assert.equal(commitAim(ev("(cd /a && git commit -m x) && echo done")).tree, "/a");
  assert.equal(commitAim(ev("cd /a && (git commit -m x)")).tree, "/a");
  assert.equal(commitAim(ev("git commit -m x && cd /a")).tree, null, "and one after it moves nothing");
  assert.equal(commitAim(ev("cd /a && git -C /b commit -m x")).tree, "/b", "the tree it names wins over the move");
});

/* Codex's F1 and F2: a pathspec needs no `--`, a pipeline's flags are not the commit's, and a value
   a short flag ate is neither — `-ma` is a message, `-uall` is untracked-files, and `-am` is both. */
test("what a commit closes over is read from its own flags", () => {
  const aim = (command) => commitAim(ev(command));
  assert.equal(aim("git commit -am x").all, true);
  assert.equal(aim("git commit --all").all, true);
  assert.equal(aim("git commit -ma").all, false, "a message whose text is `a`");
  assert.equal(aim("git commit -uall -m x").all, false, "untracked-files, not all");
  assert.equal(aim("git commit -m x | tee -a log").all, false, "the pipeline's flag is not the commit's");
  assert.deepEqual(aim("git commit -m x docs/A.md").paths, ["docs/A.md"], "a pathspec without --");
  assert.deepEqual(aim("git commit -m x -- docs/A.md 'docs/a b.md'").paths, ["docs/A.md", "docs/a b.md"]);
  assert.deepEqual(aim("git commit -o docs/A.md -m x").paths, ["docs/A.md"], "-o takes no value");
  assert.deepEqual(aim("git commit -am x").paths, [], "the message is not a path");
  assert.deepEqual(aim("git commit -m work >/tmp/commit.log").paths, [], "and neither is a redirect's target");
  assert.deepEqual(aim("git commit --author='a b' -m x").paths, [], "a long flag's attached value");
  assert.deepEqual(aim("git commit --author 'a b' -m x").paths, [], "and its detached one");
  assert.deepEqual(aim(String.raw`git commit -m x docs/a\ b.md`).paths, ["docs/a b.md"], "an escaped space is inside a word");
  assert.equal(commitAim(ev(String.raw`cd /tmp/a\ b && git commit -m x`)).tree, "/tmp/a b", "and inside a moved-to path");
});

test("a commit is a commit where a command starts, git's globals in between", () => {
  const ask = (command) => committing({ tool_name: "Bash", tool_input: { command } });
  for (const one of ["git commit -m x", "git -C /r commit", "git -c k=v commit", "git --no-pager commit",
    "git --git-dir /r/.git commit", "git --work-tree /r commit", "git --git-dir=/r/.git commit",
    'sh -c "git commit -m x"']) assert.ok(ask(one), one);
  for (const one of ["git commit-tree x", "git log --grep commit", 'echo "run git commit" > notes.md']) {
    assert.ok(!ask(one), one);
  }
});

test("a repeated -C composes, and -C outranks what a --git-dir implies", () => {
  assert.equal(commitAim(ev("git -C /a -C b commit -m x")).tree, "/a/b");
  assert.equal(commitAim(ev("git -C /a -C /b commit -m x")).tree, "/b", "an absolute hop replaces what preceded it");
  assert.equal(commitAim(ev("cd /p && git -C a -C b commit -m x")).tree, "/p/a/b", "a relative chain is still the shell's to place");
  assert.equal(commitAim(ev("git -C /a --work-tree=w commit -m x")).tree, "/a/w");
  assert.equal(commitAim(ev("git -C /a --git-dir=.git commit -m x")).tree, "/a");
  assert.equal(commitAim(ev("git --work-tree /w --git-dir /m/repo.git commit -m x")).tree, "/w", "and the ranking survives");
  assert.equal(commitAim(ev("git -C /b --git-dir /m/repo.git commit -m x")).tree, "/b", "a bare git directory is no tree");
  assert.equal(commitAim(ev("git -C /b --git-dir /repo/.git/worktrees/x commit -m y")).tree, "/b", "and worktree metadata is none either");
  assert.equal(commitAim(ev("git -C /dirty --git-dir /clean/.git commit -m x")).tree, "/dirty", "an absolute .git left the base behind too");
  assert.equal(commitAim(ev("git -C /a -C b --git-dir /m/repo.git commit -m x")).tree, "/a/b", "outranked by a chain as by one hop");
  assert.equal(commitAim(ev("git --git-dir /w/.git commit -m x")).tree, "/w", "with no -C the implication is still what answers");
  assert.equal(commitAim(ev("git -C / --git-dir /clean/.git commit -m x")).tree, "/", "a root hop is a hop, whatever trimming its own separator leaves");
  assert.equal(commitAim(ev("git -C / --work-tree=w commit -m x")).tree, "/w", "and it is a base like any other");
});

/* `movedTo` answered `null` both for a shell that never moved and for one that moved somewhere the
   command's text does not carry, so `cd - && git commit` read as a commit in the event's cwd: the
   pending list of one repository demanded of a commit in another, and — where the cwd owed nothing —
   the commit landing with what it stages read by nobody (ISS-211). */
test("a commit whose tree the command does not name reads as no tree at all", () => {
  assert.equal(commitAim(ev("cd - && git commit -m x")).tree, NOWHERE, "`cd -` is $OLDPWD, which the text does not carry");
  assert.equal(commitAim(ev("cd && git commit -m x")).tree, NOWHERE, "and a bare cd is $HOME");
  assert.equal(commitAim(ev("cd $D/x && git commit -m x")).tree, NOWHERE, "and a destination built from a value is a name nothing here can check");
  assert.equal(commitAim(ev("cd - && git -C sub commit -m x")).tree, NOWHERE, "a relative -C over an unnamed base names nothing either");
  assert.equal(commitAim(ev("cd - && git -C /sub commit -m x")).tree, "/sub", "while an absolute one needs no base, so the doubt ends");
  assert.deepEqual(
    commitAim(ev("git commit -m a && cd - && git commit -m b")).others,
    [NOWHERE],
    "and a second commit in the call carries the same answer",
  );
});
