/* One reading of a shell word for every reader in the module, so two readings of one command cannot
   place a target in two places: a redirect's target, an operand and a word a write verb aims at are
   each the word `shellWord` reads (ISS-2959). */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { shellText, writtenPaths } from "../../../hooks/_hook.mjs";
import { redirectsIn, unseenNames, wordsOf } from "../../../src/hooks/shell-spans.mjs";
import { patience } from "../../patience.mjs";

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

/* The assignment reading splices a word into a lookbehind, which matches right to left: a lone quote's
   test standing behind its quote ran first there, scanning the rest of the text from every position,
   and six thousand assignments held the hook for seconds. Read in a process of its own, which a hang
   guard can stop. */
test("a command of many assignments has its values read in one pass", () => {
  const hook = new URL("../../../hooks/_hook.mjs", import.meta.url).href;
  const asked = `import(${JSON.stringify(hook)}).then(({ shellText }) => process.stdout.write(String(shellText(process.argv[1]).length)))`;
  const text = `env ${Array.from({ length: 6_000 }, (_, i) => `A${i}=x${i}`).join(" ")} true`;
  const run = spawnSync(process.execPath, ["-e", asked, text], { encoding: "utf8", timeout: patience(3000) });
  assert.equal(run.stdout, String(text.length), run.signal ?? run.stderr);
});
