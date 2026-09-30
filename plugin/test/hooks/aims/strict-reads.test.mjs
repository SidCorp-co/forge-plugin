/* The strict reading is what a gate that must not invent a target takes, plan-scope among them: a
   word a stage only reads is struck, and a write verb's own target stays. Read broadly, a revision
   range piped into `tee` was held as a written path and the refusal asked for a correction naming
   it (ISS-2427). */
import assert from "node:assert/strict";
import test from "node:test";

import { shellWrites, writtenPaths } from "../../../hooks/_hook.mjs";

const read = (command, unplaceable = "strike") =>
  writtenPaths(shellWrites(command), "/w", undefined, { unplaceable }).map((one) => one.token);

test("a flag's value in a stage that writes nothing is no candidate", () => {
  assert.deepEqual(read("git diff --name-only origin/main...HEAD | tee /tmp/x/files.txt | wc -l"), ["/tmp/x/files.txt"]);
  assert.deepEqual(read("git diff --stat a.md | tee b.md"), ["b.md"]);
  assert.deepEqual(read("git diff -- a.md | tee b.md"), ["b.md"]);
});

test("a program body in a stage that writes nothing is no candidate", () => {
  const bodies = [
    `cat a.json | python3 -c "import json,sys; m=json.load(sys.stdin); print(m)"`,
    "node -e 'const q=require(\"a.md\")'",
    "perl -e 'print $x.md'",
    `sh -c 'printf "%s\\n" source.md'`,
  ];
  for (const body of bodies) assert.deepEqual(read(`${body} | tee /tmp/out.txt`), ["/tmp/out.txt"], body);
});

test("a write verb's flag that takes no value leaves its target a candidate", () => {
  for (const command of ["echo x | tee -a docs/x.md", "touch -a docs/x.md", "truncate -c docs/x.md"]) {
    assert.deepEqual(read(command), ["docs/x.md"], command);
  }
});

test("a write verb's flag that takes a value leaves that value out", () => {
  assert.deepEqual(read("touch -r ref.md docs/x.md"), ["docs/x.md"]);
  assert.deepEqual(read("truncate -s 0 docs/x.md"), ["docs/x.md"]);
  assert.deepEqual(read("touch -t 202601010000 docs/x.md"), ["docs/x.md"], "`touch -t` is a time, not a target directory");
});

test("a write behind a list operator is struck as one at the start is", () => {
  const listed = read("sed -i 's/a/b/' f.ts && cp draft/a.test.ts ./a.test.ts");
  assert.deepEqual(listed, ["f.ts", "./a.test.ts"]);
  assert.ok(!listed.includes("draft/a.test.ts"));
  assert.deepEqual(read("cd x && ( cp a.md b.md )"), ["b.md"], "a subshell's parentheses are no operands");
  assert.deepEqual(read("( cp a.md b.md )", "keep"), ["b.md"]);
});

test("the keep reading leaves a span whose destination is handed over whole", () => {
  assert.deepEqual(read("cat a.md | xargs -I{} cp {} b.md", "keep"), ["a.md", "b.md"]);
  assert.deepEqual(read("find . -name a.md -exec cp {} b.md \;", "keep"), ["a.md", "b.md"]);
  assert.deepEqual(read("cat a.md | xargs -I{} cp {} b.md"), [], "and the strict reading takes none of it");
});
