/* One reading of a shell word for every reader in the module, so two readings of one command cannot
   place a target in two places: a redirect's target, an operand and a word a write verb aims at are
   each the word `shellWord` reads (ISS-2959). */
import assert from "node:assert/strict";
import test from "node:test";

import { shellText, writtenPaths } from "../../../hooks/_hook.mjs";
import { redirectsIn, unseenNames, wordsOf } from "../../../src/hooks/shell-spans.mjs";

const NBSP = " ";

test("an escaped quote inside a double-quoted redirect target is part of the target", () => {
  assert.deepEqual(unseenNames(String.raw`echo hi > "a\" $X.md"`), [String.raw`"a\" $X.md"`]);
});

test("a redirect's target and a command's operand end at the same characters, the shell's blanks", () => {
  assert.deepEqual(wordsOf(`cp a b${NBSP}c.md`).map(([word]) => word), ["cp", "a", `b${NBSP}c.md`]);
  assert.deepEqual(redirectsIn(`echo > b${NBSP}c.md`).map((one) => one.target), [`b${NBSP}c.md`]);
});

/* The name walk ends a bare word where the operand reading does, or the operand struck as a source
   comes back as a fragment of the destination, and a write is claimed on a file nobody named. */
test("a destination holding a no-break space is named whole, and no fragment of it is a target", () => {
  for (const unplaceable of ["strike", "keep"]) {
    assert.deepEqual(writtenPaths(`cp src.md protected.md${NBSP}actual.md`, "/w", "md", { unplaceable }).map((one) => one.token),
      [`protected.md${NBSP}actual.md`], unplaceable);
  }
});

test("a quoted word a shell reads as a flag is no write target, as the struck reading already takes it", () => {
  assert.deepEqual(unseenNames('tee "-$OPT" x.md'), []);
});

test("an assignment's value is the whole word the shell assigns, an escaped space inside it", () => {
  assert.equal(shellText(String.raw`D=a\ b; touch $D/x.md`), String.raw`D=a\ b; touch a\ b/x.md`);
});
