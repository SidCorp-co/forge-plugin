/* A `$` ended a word, so what stood behind an expansion was handed on as a name of its own: the
   variable's name and the rest of the path, or whatever a space, a bracket or a `}` cut it to next —
   a relative name the working directory resolved, while the file the command wrote was somewhere
   else entirely (ISS-3085). */
import assert from "node:assert/strict";
import test from "node:test";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { named, touched, writtenPaths } from "../../../hooks/_hook.mjs";
import { guardedShape } from "../../../src/checks/learning.mjs";
import { namesOf } from "../../../src/hooks/shell-spans.mjs";
import { tempRoom } from "../../fixtures.mjs";

const written = (command) => writtenPaths(command, "/cwd").map(({ token, trees }) => [token, trees]);
const names = (command) => namesOf(command).map((one) => one.token);

const BEHIND = [
  ['echo x > "/m/$d ace/t.md"', "$d ace/t.md", "ace/t.md"],
  ['echo x > "/m/$d/t.md"', "$d/t.md", "d/t.md"],
  ['echo x > "/m/${d}x/t.md"', "${d}x/t.md", "x/t.md"],
  ["echo x > /m/$d/t.md", "$d/t.md", "d/t.md"],
  ['printf x > "/r/p(1)/$d.md"', "$d.md", "d.md"],
];

test("the text behind an expansion is never named as a file of its own", () => {
  for (const [command, , tail] of BEHIND) {
    assert.ok(!written(command).some(([token]) => token === tail), `${command} names no ${tail}`);
  }
});

test("an operand holding an expansion is named from its `$`, the expansion kept, and placed in no tree", () => {
  for (const [command, name] of BEHIND) {
    assert.deepEqual(written(command), [[name, []]], command);
  }
  assert.deepEqual(written("echo x > ${OUT}/x.md"), [["${OUT}/x.md", []]], "a `}` opening the operand leaves no rooted tail");
});

test("the readings the expansion does not reach are the ones they were", () => {
  assert.deepEqual(written("echo x > $OUT"), [], "a `$` ending the operand names nothing");
  assert.deepEqual(written('echo x > "$(pwd)/a.md"').map(([token]) => token), ["/a.md"], "a substitution is placeable's to answer");
  assert.deepEqual(written("echo x > \x60pwd\x60/a.md").map(([token]) => token), ["/a.md"], "a backtick pair as well");
  assert.ok(names(`perl -e "open(F, '>$d/a.md'); open(G, '>/tmp/b.md')"`).includes("/tmp/b.md"),
    "a quote of the other kind ends the word, so a body's next target is still read");
});

test("a brace a default quotes or escapes closes no expansion, so the name still reaches its end", () => {
  for (const command of ['echo x > ${BASE:-"}"}/.claude/skills/demo/SKILL.md', "echo x > ${BASE:-\\}}/.claude/skills/demo/SKILL.md"]) {
    const found = written(command);
    assert.deepEqual(found, [["${BASE:-}}/.claude/skills/demo/SKILL.md", []]], command);
    assert.ok(guardedShape(found[0][0]), `${command} is still a skill's own text to the learning gate`);
  }
});

test("a name an expansion opens is resolved in no directory and looked up on no disk", () => {
  const room = tempRoom("expansions-");
  mkdirSync(join(room, "$d"));
  writeFileSync(join(room, "$d", "a.md"), "x\n");
  const ev = { session_id: "s1", tool_name: "Bash", tool_input: { command: "echo x > $d/a.md" }, cwd: room, transcript_path: "" };
  assert.deepEqual(named(ev), ["$d/a.md"], "answered as spelt, since the event's own directory is not where the shell writes it");
  assert.deepEqual(touched(ev), [], "and a fresh file spelt with the `$` itself is none this call wrote");
});
