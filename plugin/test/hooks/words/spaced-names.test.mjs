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
});

test("a quoted span that is not one path keeps the reading it had", () => {
  assert.deepEqual(names("touch 'a.md b.md'"), ["a.md", "b.md"], "a list of names is still two candidates");
  assert.deepEqual(names("printf x > '/r/a.md /r/b.md'"), ["/r/a.md", "/r/b.md"], "and a list of rooted ones");
  assert.deepEqual(written("git commit -m 'cp notes into /x/memory/a.md'"), [],
    "a sentence opens with a word, so the gates' reader still blanks it");
  for (const one of ["sh -c '/bin/cp a.md b.md'", "bash -lc '/bin/cp a.md b.md'", "eval '/bin/cp a.md b.md'"]) {
    assert.deepEqual(names(one), ["a.md", "b.md"], `${one} is a body a shell runs, so its words stay words`);
  }
  for (const command of ["touch 'a.md b.md'", "touch '/r/a /b.md'", "touch '/r/a b/w.md'.bak", "touch '/r/a b/w'", "sh -c '/bin/cp a.md b.md'"]) {
    assert.deepEqual([...spacedSpans(command)], [], `${command} is not judged one path`);
  }
});
