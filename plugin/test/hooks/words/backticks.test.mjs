/* A backtick pair is a substitution a shell runs, so a command standing at its opening backtick starts
   there for every reader of where a command starts, bare or under a double quote, and the word after the
   closing one starts nothing (ISS-3069). */
import assert from "node:assert/strict";
import test from "node:test";

import { committing, shellText, startsAt, writtenPaths } from "../../../hooks/_hook.mjs";
import { struck, ticksOpened } from "../../../src/hooks/shell-spans.mjs";

const TICK = "\x60";
const pair = (body) => `${TICK}${body}${TICK}`;
const ev = (command) => ({ tool_name: "Bash", tool_input: { command } });
const said = (text) => startsAt(shellText(text)).map((one) => one.said);
const opensWith = (text, verb) => said(text).some((one) => one.startsWith(verb));

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
  assert.ok(opensWith(`echo ${pair("git stash")}`, "git stash"), JSON.stringify(said(`echo ${pair("git stash")}`)));
  assert.ok(opensWith(`echo "${pair("git stash")}"`, "git stash"), "under a double quote");
});

test("the word after a closing backtick starts nothing", () => {
  const text = `echo ${pair("date")} git commit`;
  assert.equal(committing(ev(text)), false);
  assert.ok(!opensWith(text, "git commit"), JSON.stringify(said(text)));
  assert.equal(committing(ev(`echo ${pair("")} git commit`)), false, "nor after an empty pair");
});

/* An operator inside the pair cuts the span after it, and that span holds the closer without its opener: walked alone it would read the closer as one. */
test("a closer cut off from its opener by an operator inside the pair opens no write", () => {
  const text = `echo ${pair("date; true")} touch a.md`;
  assert.equal(struck(text, { unplaceable: "strike" }), text);
  assert.deepEqual(writtenPaths(text, "/w", undefined, { unplaceable: "strike" }), []);
  assert.ok(!opensWith(text, "touch"), JSON.stringify(said(text)));
});

/* A quote's data and a here-document's body are taken out before any backtick is asked about; these two stand in the text a reader tests, so only the walk keeps them from opening a pair. */
test("a backtick a backslash escapes or a comment holds is text", () => {
  for (const text of [`echo \\${TICK}git commit -m x\\${TICK}`, `# ${pair("git commit -m x")}\necho ok`]) {
    assert.equal(committing(ev(text)), false, JSON.stringify(text));
    assert.ok(!opensWith(text, "git commit"), JSON.stringify(said(text)));
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
