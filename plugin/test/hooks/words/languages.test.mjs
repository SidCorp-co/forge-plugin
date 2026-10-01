/* Which language an interpreter speaks was stated in four tables, and an interpreter one of them named
   was absent from the rest with nothing red (ISS-465). These cases iterate the one table that is left,
   so a runner or a language added to it and missed by a reading fails here rather than reading as
   python. What each language is read for is the table's own comment, and the cases below pin it. */
import assert from "node:assert/strict";
import test from "node:test";

import { handedIn, shellWrites, writtenPaths } from "../../../hooks/_hook.mjs";
import { glued } from "../../../src/hooks/program/assembled.mjs";
import { LANGUAGE_OF, spansOf } from "../../../src/hooks/program/spoken.mjs";
import { struck } from "../../../src/hooks/shell-spans.mjs";

const CWD = "/w/tree";
const read = (command, unplaceable) =>
  writtenPaths(struck(shellWrites(command), { unplaceable }), CWD).map((one) => one.token);
const both = (command, want, why = command) => {
  assert.deepEqual(read(command, "strike"), want, `strike: ${why}`);
  assert.deepEqual(read(command, "keep"), want, `keep: ${why}`);
};
const heredoc = (runner, ...lines) => [`${runner} - <<'EOF'`, ...lines, "EOF"].join("\n");
const WRITES = "open('w.md', 'w')";

test("every interpreter the table names has its inline body and its heredoc body read as a program", () => {
  for (const runner of Object.keys(LANGUAGE_OF)) {
    both(heredoc(runner, WRITES), ["w.md"], `${runner}'s heredoc`);
    /* The keeping reading also reads the inline body it leaves standing, so the literal is there twice. */
    for (const mode of ["strike", "keep"]) {
      assert.deepEqual([...new Set(read(`${runner} -e "${WRITES}"`, mode))], ["w.md"], `${mode}: ${runner}'s inline body`);
    }
  }
  both(heredoc("lua", WRITES), [], "while a runner the table does not name is handed data");
});

/* The comment each language writes, so a language the table gains without one here fails by name. */
const COMMENT = { python: "#", node: "//", perl: "#", ruby: "#", php: "//" };

test("every language the table names has a walk that finds its own comment", () => {
  for (const lang of new Set(Object.values(LANGUAGE_OF))) {
    assert.ok(COMMENT[lang], `name the comment ${lang} writes in COMMENT`);
    const text = `x = 1 ${COMMENT[lang]} note`;
    assert.deepEqual(spansOf(text, lang).filter((one) => one.comment).map((one) => text.slice(one.from, one.to)),
      [`${COMMENT[lang]} note`], lang);
  }
});

test("a file call inside a perl or ruby body's # comment is no write", () => {
  for (const runner of ["perl", "ruby"]) {
    both(heredoc(runner, "# open('a.md', 'w')", "open('b.md', 'w')"), ["b.md"], runner);
  }
});

test("a file call inside a php body's line or block comment is no write", () => {
  both(heredoc("php", "<?php", "// open('a.md', 'w')", "/* open('c.md', 'w') */", "open('b.md', 'w');"), ["b.md"]);
});

test("a shell's heredoc body is that shell's commands", () => {
  both(heredoc("bash", 'tee "a.md" < x'), ["a.md"], "a write in it still counts");
  const body = 'tee x/"p.md" < a';
  both(heredoc("bash", 'x="/etc"', body), read(body, "strike"),
    "and an assignment there binds nothing the bare name after it spells, which python's fold read as /etc/p.md");
});

test("the path fold reads only the languages whose bindings and + are python's", () => {
  const body = 'x = "/etc"\nopen(x + "/p.md", "w")';
  assert.equal(glued(body, "python"), 'x = "/etc"\nopen("/etc/p.md", "w")', "python's is folded to the path it built");
  for (const runner of ["perl", "php"]) assert.equal(glued(body, runner), body, `${runner}'s comes back as written`);
  assert.deepEqual(read(heredoc("ruby", 'root = "/tmp"', 'File.open(root + "/x.md", "w")'), "keep"), ["/tmp/x.md"],
    "and ruby's still yields the path it built");
});

test("perl, ruby and php keep every spawn name, having none of their own", () => {
  for (const runner of ["perl", "ruby", "php"]) {
    for (const call of ["subprocess", "child_process"]) {
      assert.deepEqual(handedIn(`${call}("git status")`, runner), ["git status"], `${runner} naming ${call}`);
    }
  }
});
