/* A space under a quote ended a word wherever it stood, so a write into a directory named `sp ace`
   was read as the tail behind the space, which names another file — and a scratch root carrying
   one turned nine cases of the suite red (ISS-1594). */
import assert from "node:assert/strict";
import test from "node:test";

import { writtenPaths } from "../../../hooks/_hook.mjs";
import { namesOf, spacedSpans } from "../../../src/hooks/shell-spans.mjs";

const names = (command) => namesOf(command).map((one) => one.token);
const aimed = (command) => namesOf(command, undefined, { options: false }).map((one) => one.token);
const written = (command) => writtenPaths(command, "/cwd").map((one) => one.token);

test("a rooted path whose directory carries a space is named whole, and never as the tail behind it", () => {
  for (const command of ["printf x > '/r/sp ace/written.md'", "printf x > '/r/sp  ace/written.md'", "printf x > '/r/paren (one)/written.md'"]) {
    const whole = command.slice(command.indexOf("'") + 1, -1);
    assert.deepEqual(names(command), [whole], command);
    assert.deepEqual(aimed(command), [whole], `${command}, read as a redirect's target`);
    assert.deepEqual(written(command), [whole], `${command}, through the gates' reader`);
  }
  assert.deepEqual(names("cp x.md '~/notes dir/a.md'"), ["~/notes dir/a.md", "x.md"], "a home roots one as well");
});

test("a verb's quoted operand is named by the same judgement the redirect reader spends", () => {
  assert.deepEqual(written("touch '/r/sp ace/w.md'"), ["/r/sp ace/w.md"],
    "kept by the reader that blanks a quoted sentence, since it is no sentence");
  assert.deepEqual([...spacedSpans("touch '/r/sp ace/w.md'")], [6], "the span is judged where its quote opens");
  assert.deepEqual(written("touch -c '/r/sp ace/w.md'"), ["/r/sp ace/w.md"],
    "and a `-c` is a body's only after a shell, so the one a verb takes leaves its operand a path");
});

test("a quoted span that is not one path keeps the reading it had", () => {
  assert.deepEqual(names("touch 'a.md b.md'"), ["a.md", "b.md"], "a list of names is still two candidates");
  assert.deepEqual(names("printf x > '/r/a.md /r/b.md'"), ["/r/a.md", "/r/b.md"], "and a list of rooted ones");
  assert.deepEqual(written("git commit -m 'cp notes into /x/memory/a.md'"), [],
    "a sentence opens with a word, so the gates' reader still blanks it");
  for (const one of ["sh -c '/bin/cp a.md b.md'", "bash -lc '/bin/cp a.md b.md'", "bash -o pipefail -lc '/bin/cp a.md b.md'", "eval '/bin/cp a.md b.md'"]) {
    assert.deepEqual(names(one), ["a.md", "b.md"], `${one} is a body a shell runs, so its words stay words`);
  }
  for (const command of ["touch 'a.md b.md'", "touch '/r/a /b.md'", "touch '/r/a b/w.md'.bak", "touch '/r/a b/w'", "sh -c '/bin/cp a.md b.md'"]) {
    assert.deepEqual([...spacedSpans(command)], [], `${command} is not judged one path`);
  }
});

/* A double quote was left out of that judgement, so the same directory spelled under one was still
   read as the tail behind its space, and a guarded memory path let a write through (ISS-3081). */
test("a double-quoted path whose directory carries a space is named whole, and never as the tail behind it", () => {
  assert.deepEqual(written('echo x > "/m/sp ace/trap.md"'), ["/m/sp ace/trap.md"], "through the gates' reader");
  assert.deepEqual(names('echo x > "/m/sp ace/trap.md"'), ["/m/sp ace/trap.md"]);
  assert.deepEqual(aimed('echo x > "/m/sp ace/trap.md"'), ["/m/sp ace/trap.md"], "read as a redirect's target");
  assert.deepEqual(names('echo x > "/m/memory/my trap.md"'), ["/m/memory/my trap.md"], "a filename carrying one");
  assert.deepEqual(written('echo x > "/m/memory/my trap.md"'), ["/m/memory/my trap.md"]);
  assert.deepEqual([...spacedSpans('echo x > "/m/sp ace/trap.md"')], [9], "judged where its quote opens");
  assert.deepEqual([...spacedSpans('printf x > "/r/paren (one)/written.md"')], [11]);
  assert.deepEqual(written('touch "/m/sp ace/w.md"'), ["/m/sp ace/w.md"], "a verb's operand, which was blanked as a sentence");
  assert.deepEqual(written('printf x > "/r/paren (one)/written.md"'), ["/r/paren (one)/written.md"],
    "a bracket is a path's under a double quote as it is under a single one");
});

test("a double-quoted span the shell still expands, or that is not one path, keeps the reading it had", () => {
  assert.deepEqual(names('touch "a.md b.md"'), ["a.md", "b.md"], "a list of names is still two candidates");
  for (const command of ['echo x > "/m/$d ace/t.md"', 'echo x > "/m/\x60d\x60 ace/t.md"', 'echo x > "/m/a\\" b/t.md"']) {
    assert.deepEqual([...spacedSpans(command)], [], `${command} spells a name the shell rewrites, so it is not judged one path`);
  }
  assert.deepEqual(written('git commit -m "cp notes into /x/memory/a.md"'), [], "a sentence is still blanked");
  assert.deepEqual(names('sh -c "/bin/cp a.md b.md"'), ["a.md", "b.md"], "a body a shell runs keeps its words");
  for (const command of ['sh -c \\\n"/bin/cp a.md b.md"', "sh -c \\\n'/bin/cp a.md b.md'"]) {
    assert.deepEqual(names(command), ["a.md", "b.md"], `${command}: a line continued onto the body is still a body`);
  }
});

/* A double quote holding a bracket and no space got neither reading — the bracket cut it, and only a
   span with a space was read whole — so the name was the tail behind the bracket (ISS-3084). */
test("a double-quoted path holding a bracket is named whole beside the bracket reading, never only as its tail", () => {
  assert.deepEqual(written('printf x > "/r/p(1)/w.md"'), ["/r/p(1)/w.md", "/w.md"], "through the gates' reader");
  assert.deepEqual(names('printf x > "/r/p(1)/w.md"'), names("printf x > '/r/p(1)/w.md'"), "read as the single-quoted spelling is");
  assert.deepEqual(names('printf x > "/r/p(1)/w.md"'), ["/r/p(1)/w.md", "/w.md"]);
  assert.ok(written('touch "/r/p(1)/w.md"').includes("/r/p(1)/w.md"), "a verb's operand as well");
});

test("a double-quoted bracketed span the shell rewrites, or that is not the whole operand, is not named whole", () => {
  for (const command of ['printf x > "/r/p(1)/$d.md"', 'printf x > "/r/p(1)/\x60d\x60.md"', 'printf x > "/r/p(1)/a\\b.md"', 'printf x > "/r/p(1)/w.md".txt']) {
    assert.deepEqual(written(command).filter((one) => one.startsWith("/r/p(1)/")), [], command);
  }
  assert.ok(names('perl -e "system(q(touch),q(b.md))"').includes("b.md"), "a body's call keeps its bracket reading");
});
