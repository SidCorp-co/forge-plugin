/* `exec` runs the command after it only where the shell runs `exec` itself; as another program's
   argument it names a subcommand, and `docker exec` runs its command inside a container (ISS-2877). */
import assert from "node:assert/strict";
import test from "node:test";

import { COMMITS, WRITES, startsAt, writtenPaths } from "../../../hooks/_hook.mjs";

test("an exec starts a command at the head of one and behind any other start", () => {
  for (const lead of ["", "true; ", "(", "A=1 ", "sudo ", "then "]) {
    assert.equal(WRITES.test(`${lead}exec touch f`), true, `${JSON.stringify(lead)} then exec`);
    assert.equal(COMMITS.test(`${lead}exec git commit -m x`), true, `${JSON.stringify(lead)} then exec, a commit`);
  }
});

test("an exec another program takes as its argument starts nothing", () => {
  for (const one of ["docker exec ctr", "podman exec ctr", "kubectl exec pod --", "echo exec"]) {
    assert.equal(WRITES.test(`${one} touch f`), false, one);
    assert.equal(COMMITS.test(`${one} git commit -m x`), false, `${one}, a commit`);
  }
});

/* A span cut behind a list operator opens with the blank the operator left, and the command is the same
   one it would be at the head of the text: `WRITES` read every command of a list but the first as no
   write, and a commit an indented call made was no commit (ISS-2933). */
test("a command opening with a blank starts where the same command without it does", () => {
  for (const lead of [" ", "\t", "  "]) {
    assert.equal(WRITES.test(`${lead}cp a.md b.md`), true, `${JSON.stringify(lead)} then a copy`);
    assert.equal(COMMITS.test(`${lead}git commit -m x`), true, `${JSON.stringify(lead)} then a commit`);
  }
  for (const one of [" echo x", " git status", " printf cp"]) assert.equal(WRITES.test(one), false, one);
});

/* A quoted program is the program the shell runs, and the blanks a start takes stop at it rather than
   crossing it, at the head of the text as behind an operator, an assignment or a wrapper. */
test("a start's blanks do not run across a quoted program", () => {
  const said = (text) => startsAt(text).map((one) => one.said);
  assert.deepEqual(startsAt("'echo' rm -rf /"), [{ said: "echo rm -rf /", at: 0 }]);
  assert.deepEqual(startsAt("  rm -rf /"), [{ said: "rm -rf /", at: 2 }], "and an indented command still starts where its verb does");
  assert.deepEqual(said("true; 'rm' -rf /"), ["true", "rm -rf /"]);
  assert.deepEqual(said("A=1 'echo' rm -rf /"), ["echo rm -rf /"]);
  assert.deepEqual(said("sudo 'rm' -rf /"), ["rm -rf /"]);
});

/* A substitution a double quote opened is a shell's body, so a command starts in it; the data around it holds none (ISS-1533). */
test("a command starts inside a substitution a double quote opened, and nowhere else in the quote", () => {
  const said = (text) => startsAt(text).map((one) => one.said);
  const starts = (text) => said(text).some((one) => one.startsWith("git stash"));
  assert.ok(starts('echo "$(git stash)"'), "a $(…) under a double quote");
  assert.ok(starts('echo "`true; git stash`"'), "a backtick pair under one");
  assert.deepEqual(said('echo "a; git stash"'), ['echo "a; git stash"'], "and a separator the quote holds starts nothing");
  assert.deepEqual(said("echo it\\'s; git stash; echo 'x'"), ["echo it\\'s", "git stash", "echo 'x'"],
    "nor does an apostrophe a backslash made literal open a quote that hides the next command");
});

/* The write reading takes a quoted span that cannot be one filename out of the text, and what stands in
   for it has to stop a start as the quoted program did, or the head's blanks read its argument as the verb. */
test("the word after a quoted program is that program's argument in the write reading", () => {
  const named = (text) => writtenPaths(text, "/w").map((one) => one.token);
  assert.deepEqual(named("'a b' cp x.md y.md"), []);
  assert.deepEqual(named("true; 'a b' cp x.md y.md"), [], "behind an operator as at the head");
  assert.deepEqual(named("cp x.md 'a b' y.md"), ["x.md", "y.md"], "and a copy carrying one still writes");
});

/* A runner's option value is one shell word, an escaped space inside it: cut at the escape, the half
   behind it read as the verb, and `xargs -d a\ b rm x` started a `b` nobody runs (ISS-2959). */
test("a runner's option value holding an escaped space is one word, and the verb is the word after it", () => {
  const said = startsAt(String.raw`xargs -I {} -d a\ b rm x`).map((one) => one.said);
  assert.ok(said.includes("rm x"), JSON.stringify(said));
  assert.ok(!said.includes("b rm x"), JSON.stringify(said));
});
