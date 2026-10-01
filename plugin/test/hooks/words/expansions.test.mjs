/* A `$` ended a word, so what stood behind an expansion was handed on as a name of its own: the
   variable's name and the rest of the path, or whatever a space, a bracket or a `}` cut it to next —
   a relative name the working directory resolved, while the file the command wrote was somewhere
   else entirely (ISS-3085). */
import assert from "node:assert/strict";
import test from "node:test";

import { writtenPaths } from "../../../hooks/_hook.mjs";
import { namesOf } from "../../../src/hooks/shell-spans.mjs";

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
