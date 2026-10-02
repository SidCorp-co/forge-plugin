/* The one reading of which directory a command start stands in, which every gate asking it spends
   rather than composing `movedTo`, the sentinel and a `resolve` of its own (ISS-1455). Two copies of
   that composition had already drifted: one carried the sentinel out, the other nulled it. */
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { MOVE_WORD, NOWHERE, directoryAt } from "../../../src/hooks/shell-spans.mjs";

const at = (text, word) => text.indexOf(word);

test("a compound command crossing checkouts stands in each checkout at its own command start", () => {
  const text = "cd /a && forge advance ISS-1; cd /b && forge advance ISS-2";
  assert.equal(directoryAt(text, at(text, "forge advance ISS-1"), "/cwd"), "/a");
  assert.equal(directoryAt(text, at(text, "forge advance ISS-2"), "/cwd"), "/b");
  assert.equal(directoryAt(text, 0, "/cwd"), "/cwd", "the first start, before any move, is the base");
});

test("a relative move is placed against the base, and without one comes back as the text spells it", () => {
  const text = "cd sub && forge advance ISS-1";
  assert.equal(directoryAt(text, at(text, "forge"), "/cwd"), "/cwd/sub");
  assert.equal(directoryAt(text, at(text, "forge")), "sub", "a caller placing it later gets it unplaced");
  assert.equal(directoryAt("forge advance ISS-1", 0), null, "and no move at all is no directory of its own");
});

/* A backslash keeps a double quote open, so the destination is the whole word and not the part before its space; how the word is then spelt is `spelled`'s. */
test("a destination is cut where a shell word ends, an escaped quote inside it included", () => {
  const text = String.raw`cd "/a\" b" && forge advance ISS-1`;
  assert.ok(directoryAt(text, at(text, "forge"), "/cwd").endsWith(" b"), "the word runs past its escaped quote");
});

/* The word is then spelt the way a shell hands it on: a quote a backslash or the other quote made literal stays in the name, and only the quotes and backslashes a shell removes go (ISS-2871). Each expected directory is the one bash enters. */
test("a destination is spelt as the shell hands it on, each quote and backslash a quoting kept still in the name", () => {
  const cases = [
    [String.raw`"/a\" b"`, `/a" b`],
    [String.raw`'/a\b'`, String.raw`/a\b`],
    [String.raw`"/a\b"`, String.raw`/a\b`],
    [`'/a"b'`, `/a"b`],
    [`"/a'b"`, `/a'b`],
    [String.raw`/a\"b`, `/a"b`],
    [String.raw`/a\ b`, "/a b"],
  ];
  for (const [word, entered] of cases) {
    const text = `cd ${word} && forge advance ISS-1`;
    assert.equal(directoryAt(text, at(text, "forge"), "/cwd"), entered, word);
  }
});

test("a leading tilde names the home only where it stands bare, and a quoted or escaped one is a directory named ~", () => {
  for (const word of [`"~/x"`, `"~"/x`, String.raw`\~/x`, `~"/x"`]) {
    const text = `cd ${word} && forge advance ISS-1`;
    assert.equal(directoryAt(text, at(text, "forge"), "/cwd"), "/cwd/~/x", word);
  }
  const text = "cd ~/x && forge advance ISS-1";
  assert.equal(directoryAt(text, at(text, "forge"), "/cwd"), join(homedir(), "x"), "a bare tilde still expands");
});

test("a destination the text does not carry is NOWHERE, whatever base is given", () => {
  for (const text of ["cd - && forge advance ISS-1", "cd && forge advance ISS-1", "cd \"$X\" && forge advance ISS-1"]) {
    assert.equal(directoryAt(text, at(text, "forge"), "/cwd"), NOWHERE, text);
    assert.equal(directoryAt(text, at(text, "forge")), NOWHERE, `${text}, with no base`);
  }
});

/* A reader of many calls walks only the texts MOVE_WORD matches, so one it misses is a move read as none (ISS-545). */
test("MOVE_WORD matches every text the reading finds a move in, and a text it misses moves nothing", () => {
  for (const text of ["printf ok; cd /v", "{ cd /v; }", "if cd /v; then :; fi", "pushd /v", "popd", "cd -", "x | cd /v", "(cd /v)"]) {
    assert.ok(MOVE_WORD.test(text), `${text} is skipped, where the reading reads it`);
  }
  for (const text of ["git status --short", "echo cdrom pushdown", "make abcd popdown"]) {
    assert.equal(MOVE_WORD.test(text) ? "matched" : directoryAt(text, text.length), null, text);
  }
});
