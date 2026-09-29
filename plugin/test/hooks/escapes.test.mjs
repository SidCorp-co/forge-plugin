/* One spelling of a write target, the backslash escape. `touched` is asked with no transcript,
   which is the case where a young file answers as written, so the fixture needs no clock. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { namesOf, touched, writtenPaths } from "../../hooks/_hook.mjs";
import { quoting } from "../../src/hooks/shell-spans.mjs";
import { tempRoom } from "../fixtures.mjs";

const room = tempRoom("escapes-");
const bash = (command) => ({ session_id: "s1", tool_name: "Bash", tool_input: { command }, cwd: room, transcript_path: "" });

/* A backslash outside quotes makes the character behind it the word's, and the shell takes the
   backslash out: the word was cut at the escape instead, so `paren\(one\)/written.md` named a rooted
   `/written.md` nobody wrote and `a\ b/written.md` a relative tail (ISS-1592). */
test("a target spelled with backslash escapes is the word the shell assembles, backslashes gone", () => {
  mkdirSync(join(room, "escaped(one)"));
  const file = join(room, "escaped(one)", "written.md");
  writeFileSync(file, "x\n");
  const command = String.raw`printf x > escaped\(one\)/written.md`;
  assert.deepEqual(touched(bash(command)), [realpathSync(file)], "the file the shell wrote there");
  assert.deepEqual(writtenPaths(command, room).map((one) => one.token), ["escaped(one)/written.md"],
    "and the target is the directory's own name");
  const names = (text) => namesOf(text).map((one) => one.token);
  assert.deepEqual(names(String.raw`printf x > /tmp/paren\(one\)/written.md`), ["/tmp/paren(one)/written.md"],
    "an escaped bracket is a character of the name and cuts nothing");
  assert.deepEqual(names(String.raw`printf x > /tmp/a\ b/written.md`), ["/tmp/a b/written.md"],
    "as is an escaped space");
  assert.deepEqual(writtenPaths(String.raw`printf x > /tmp/a\ b/written.md`, room).map((one) => one.token), ["/tmp/a b/written.md"],
    "which the redirect reader is handed whole, the escape carrying the operand past the space");
  assert.deepEqual(names(String.raw`tee /tmp/a\[1\]/memory/x.md`), [],
    "and an escaped glob bracket leaves the word unnamed rather than cut to the tail behind it");
  assert.deepEqual(namesOf(String.raw`touch \(a\).md`), [{ token: "(a).md", at: 6 }],
    "a name opening with an escape is placed at the backslash, where its first character is written");
  const removed = (text) => quoting(text).filter((one) => one.removed).map((one) => one.at);
  assert.deepEqual(removed("a\\(b '\\x' \"\\y\" c\\"), [1],
    "and the backslash the shell removes is the one outside every quote with a character behind it");
});
