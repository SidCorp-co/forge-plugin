/* `exec` runs the command after it only where the shell runs `exec` itself; as another program's
   argument it names a subcommand, and `docker exec` runs its command inside a container (ISS-2877). */
import assert from "node:assert/strict";
import test from "node:test";

import { COMMITS, WRITES, committing, shellText, startsAt, writtenPaths } from "../../../hooks/_hook.mjs";
import { struck, ticksOpened } from "../../../src/hooks/shell-spans.mjs";

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

/* A backtick pair is a substitution a shell runs, so a command standing at its opening backtick starts
   there for every reader of where a command starts, bare or under a double quote, and the word after the
   closing one starts nothing (ISS-3069). */
const TICK = "\x60";
const pair = (body) => `${TICK}${body}${TICK}`;
const ev = (command) => ({ tool_name: "Bash", tool_input: { command } });
const ran = (text) => startsAt(shellText(text)).map((one) => one.said);
const opensWith = (text, verb) => ran(text).some((one) => one.startsWith(verb));

test("a commit standing at an opening backtick is a commit, bare or under a double quote", () => {
  assert.equal(committing(ev(`echo ${pair("git commit -m x")}`)), true, "bare");
  assert.equal(committing(ev(`echo "${pair("git commit -m x")}"`)), true, "under a double quote");
  assert.equal(committing(ev(`x=${pair("git commit -m x")}`)), true, "as an assignment's value");
});

test("a write verb standing at an opening backtick names its target", () => {
  const named = (text) => writtenPaths(text, "/w", undefined, { unplaceable: "keep" }).map((one) => one.token);
  assert.deepEqual(named(`echo ${pair("touch a.md")}`), ["a.md"]);
  assert.deepEqual(named(`echo ${pair("cp x.md y.md")}; echo ok`), ["x.md", "y.md"], "and a copy, behind which a list goes on");
});

test("a command starts at an opening backtick, bare and under a double quote", () => {
  assert.ok(opensWith(`echo ${pair("git stash")}`, "git stash"), JSON.stringify(ran(`echo ${pair("git stash")}`)));
  assert.ok(opensWith(`echo "${pair("git stash")}"`, "git stash"), "under a double quote");
});

test("the word after a closing backtick starts nothing", () => {
  const text = `echo ${pair("date")} git commit`;
  assert.equal(committing(ev(text)), false);
  assert.ok(!opensWith(text, "git commit"), JSON.stringify(ran(text)));
  assert.equal(committing(ev(`echo ${pair("")} git commit`)), false, "nor after an empty pair");
});

/* An operator inside the pair cuts the span after it, and that span holds the closer without its opener: walked alone it would read the closer as one. */
test("a closer cut off from its opener by an operator inside the pair opens no write", () => {
  const text = `echo ${pair("date; true")} touch a.md`;
  assert.equal(struck(text, { unplaceable: "strike" }), text);
  assert.deepEqual(writtenPaths(text, "/w", undefined, { unplaceable: "strike" }), []);
  assert.ok(!opensWith(text, "touch"), JSON.stringify(ran(text)));
});

/* A quote's data and a here-document's body are taken out before any backtick is asked about; these two stand in the text a reader tests, so only the walk keeps them from opening a pair. */
test("a backtick a backslash escapes or a comment holds is text", () => {
  for (const text of [`echo \\${TICK}git commit -m x\\${TICK}`, `# ${pair("git commit -m x")}\necho ok`]) {
    assert.equal(committing(ev(text)), false, JSON.stringify(text));
    assert.ok(!opensWith(text, "git commit"), JSON.stringify(ran(text)));
  }
});

test("a shell runner's body opened at a backtick is that shell's commands", () => {
  assert.equal(committing(ev(`echo ${pair('bash -c "git commit -m x"')}`)), true);
  assert.equal(committing(ev(`echo ${pair('bash -c "echo git commit"')}`)), false, "and its own arguments stay arguments");
});

/* The walk is the only place an opener is told from a closer: the respelling answers from it, so a pattern needs no rule of its own. */
test("which backtick opens a pair is the walk's answer", () => {
  assert.equal(ticksOpened(`a ${pair("b")} ${pair("c")}`), "a (b` (c`");
  assert.equal(ticksOpened(`a "${pair("b")}" '${pair("c")}'`), `a "(b\`" '${pair("c")}'`);
  assert.equal(ticksOpened(`a \\${TICK} ${pair("b")}`), `a \\${TICK} (b${TICK}`, "an escaped one is none");
  const whole = `x ${pair("y; z")} w`;
  const from = whole.indexOf(";") + 1;
  assert.equal(ticksOpened(whole, whole.slice(from), from), whole.slice(from), "a slice is answered for where it stands");
});
