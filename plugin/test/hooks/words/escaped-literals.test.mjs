/* A program's file call whose literal target holds a backslash escape writes the name the program
   spells, the escape resolved as its own language resolves it. Each case is read the two ways the
   gates read a command — plan-scope's, which strikes what it cannot place, and the learning gate's,
   which keeps every candidate (ISS-3134). */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { shellWrites, writtenPaths } from "../../../hooks/_hook.mjs";
import { glued } from "../../../src/hooks/program/assembled.mjs";
import { spelling } from "../../../src/hooks/program/call-writes.mjs";
import { struck } from "../../../src/hooks/shell-spans.mjs";
import { answered, callHook, homeEnv } from "../../fixtures.mjs";

const read = (command, unplaceable) =>
  writtenPaths(struck(shellWrites(command), { unplaceable }), "/w/tree").map((one) => one.token);
const both = (command, want, why = command) => {
  assert.deepEqual(read(command, "strike"), want, `strike: ${why}`);
  assert.deepEqual(read(command, "keep"), want, `keep: ${why}`);
};
const heredoc = (runner, ...lines) => [`${runner} - <<'PY'`, ...lines, "PY"].join("\n");
const python = (...lines) => heredoc("python3", ...lines);

test("an escaped quote or backslash in a python call's literal is the character it escapes", () => {
  both(python(String.raw`open("a\"b.md", "w")`), ['a"b.md'], "an escaped double quote");
  both(python(String.raw`open('it\'s.md', 'w')`), ["it's.md"], "an escaped single quote");
  both(python(String.raw`open("a\\b.md", "w")`), [String.raw`a\b.md`], "an escaped backslash");
  both(python(String.raw`open(r"a\b.md", "w")`), [String.raw`a\b.md`], "a raw literal keeps its backslash");
});

test("an escaped literal is placed wherever a plain one is", () => {
  both(python(String.raw`Path("a\"b.md").write_text(s)`), ['a"b.md'], "a pathlib receiver");
  both(python(String.raw`p = "a\"b.md"`, 'open(p, "w")'), ['a"b.md'], "a name bound to it");
  both(String.raw`python3 -c 'open("a\"b.md", "w")'`, ['a"b.md'], "an inline body");
});

test("each language resolves an escaped quote as that language does", () => {
  both(heredoc("node", String.raw`writeFileSync("it\'s.md", "x")`, String.raw`writeFileSync('a\"b.md', 'x')`),
    ["it's.md", 'a"b.md'], "node resolves either quote in either");
  for (const runner of ["ruby", "perl"]) {
    both(heredoc(runner, String.raw`open("it\'s.md", "w")`, String.raw`open('a\"b.md', 'w')`),
      ["it's.md", String.raw`a\"b.md`], `${runner}'s single quote keeps the backslash of a double`);
  }
  both(heredoc("php", String.raw`open("it\'s.md", "w")`, String.raw`open('a\"b.md', 'w')`),
    [String.raw`it\'s.md`, String.raw`a\"b.md`], "php keeps the backslash of the other quote in either");
});

test("an escape spelling a control character or a computed code point places nothing", () => {
  for (const escape of [String.raw`\n`, String.raw`\t`, String.raw`\x41`]) {
    assert.deepEqual(read(python(`open("a${escape}b.md", "w")`), "strike"), [], escape);
  }
});

test("a value the fold writes back reads back as itself in every language", () => {
  const value = String.raw`a\"b'c.md`;
  const folded = glued(String.raw`p = "a\\\"b'c.md"` + '\nopen(p, "w")', "python3");
  const written = /open\(("(?:[^"\\]|\\.)*"), "w"\)/u.exec(folded)?.[1];
  assert.ok(written, folded);
  for (const lang of ["python", "node", "ruby", "perl", "php"]) assert.equal(spelling(written, lang), value, lang);
});

test("a bound value folded into an f-string keeps its escapes", () => {
  both(python(String.raw`root = "a\\b"`, 'open(f"{root}.md", "w")'), [String.raw`a\b.md`], "a backslash");
  both(python(String.raw`root = "a\"b"`, 'open(f"{root}.md", "w")'), ['a"b.md'], "the f-string's own quote");
  both(python(String.raw`root = "a\\b"`, 'open(rf"{root}.md", "w")'), [String.raw`a\b.md`], "a raw f-string");
  assert.deepEqual(read(python(String.raw`root = "a\"b"`, 'open(rf"{root}.md", "w")'), "strike"), [],
    "and a raw one that cannot carry its own quote is not folded");
});

const LEARNING = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning", "learning-gate.mjs");
const HOME = homeEnv("escaped-literals");

test("the learning gate refuses a skill write a python body spells with an escape", () => {
  const command = python(String.raw`open("/home/dev/app/plugin/skills/it\'s/SKILL.md", "w")`);
  const run = callHook(LEARNING, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(answered(run)?.hookSpecificOutput?.permissionDecision, "deny", run.stdout);
});

test("a bound value folded into a node template keeps its escapes", () => {
  both(heredoc("node", String.raw`const root = "a\\b";`, "writeFileSync(`${root}.md`, 'x');"), [String.raw`a\b.md`], "a backslash");
  both(heredoc("node", String.raw`const root = 'a"b';`, "writeFileSync(`${root}.md`, 'x');"), ['a"b.md'], "a double quote");
});

test("a bound value holding a brace is folded into an f-string as text, not as a field", () => {
  both(python(String.raw`root = "a\\{part}"`, 'open(f"{root}.md", "w")'), [String.raw`a\{part}.md`], "a brace behind a backslash");
  both(python('root = "a{b}"', 'open(f"{root}.md", "w")'), ["a{b}.md"], "a brace alone");
  both(python('open(f"a{{b}}.md", "w")'), ["a{b}.md"], "and an f-string's own doubled brace");
});
