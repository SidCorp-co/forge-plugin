/* A redirect's operand is one word and always a filename, so a quote of the other kind, a space, a
   `$(` or a backtick standing under its quote is a character of the name the shell writes. The
   general word reader cut each of them, on the guess that a quoted span may be an interpreter's body,
   and handed on a tail or no name at all (ISS-3052). Each case is read the two ways the gates read a
   command: plan-scope's, which strikes what it cannot place, and the learning gate's, which keeps it. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { shellWrites, writtenPaths } from "../../../hooks/_hook.mjs";
import { struck } from "../../../src/hooks/shell-spans.mjs";
import { answered, callHook, homeEnv } from "../../fixtures.mjs";

const CWD = "/w/tree";
const read = (command, unplaceable) =>
  writtenPaths(struck(shellWrites(command), { unplaceable }), CWD).map((one) => one.token);
const both = (command, want, why = command) => {
  assert.deepEqual(read(command, "strike"), want, `strike: ${why}`);
  assert.deepEqual(read(command, "keep"), want, `keep: ${why}`);
};

test("a redirect target holding the other quote names the whole file", () => {
  both(`echo x > "author's.md"`, ["author's.md"]);
  both(`echo x > 'say "hi".md'`, ['say "hi".md']);
});

test("a single-quoted redirect target holding a space, a substitution opener or a backtick pair names the whole file", () => {
  both("echo x > 'a b.md'", ["a b.md"]);
  both(": > '$(a.md'", ["$(a.md"]);
  both(": > 'a`b`.md'", ["a`b`.md"]);
});

test("a redirect target spelt in quoted and escaped parts names the one file the shell joins them into", () => {
  both(String.raw`echo x > 'say "hi" it'\''s.md'`, [`say "hi" it's.md`]);
  both(String.raw`echo x > it\'s.md`, ["it's.md"]);
});

test("a redirect target in a subshell, or behind a substitution, is still the whole file", () => {
  both("(echo x > 'a b.md')", ["a b.md"]);
  both("echo $(date) > 'a b.md'", ["a b.md"]);
  both(`echo $HOME > "author's.md"`, ["author's.md"]);
});

test("a redirect target the shell still expands or globs is read as it was", () => {
  both(`echo x > "$D/a.md"`, ["$D/a.md"]);
  both("echo x > $HOME/a.md", ["$HOME/a.md"]);
  both("echo x > a*.md", []);
  both("echo x > ~/a.md", ["~/a.md"]);
  both("echo x > $(pick).md", []);
  both("echo x > `pick`.md", []);
});

/* What the whole reading is for: the learning gate, which judges a guarded path by its name, met only the tail behind the apostrophe and let the write into memory through. */
test("the learning gate refuses a redirect into memory whose name holds an apostrophe under a double quote", () => {
  const hook = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning", "learning-gate.mjs");
  const command = `echo x > "/home/dev/.claude/projects/-home-dev-app/memory/author's.md"`;
  const run = callHook(hook, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, homeEnv("quoted-targets"));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(answered(run)?.hookSpecificOutput?.permissionDecision, "deny");
});
