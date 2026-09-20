import { Linter } from "eslint";
import assert from "node:assert/strict";
import test from "node:test";
import { getLineMetrics, longestConsecutiveRun } from "../src/line-metrics.js";

function metricsFor(code) {
  let result;
  const captureRule = {
    meta: { schema: [] },
    create(context) {
      return { "Program:exit"() { result = getLineMetrics(context.sourceCode); } };
    },
  };
  const linter = new Linter();
  linter.verify(code, {
    languageOptions: { ecmaVersion: 2022 },
    plugins: { test: { rules: { capture: captureRule } } },
    rules: { "test/capture": "error" },
  });
  return result;
}

test("counts mixed code/comment lines in both sets", () => {
  const metrics = metricsFor("const a = 1; // rationale\n/* guard */ const b = 2;");
  assert.deepEqual([...metrics.codeLines], [1, 2]);
  assert.deepEqual([...metrics.commentLines], [1, 2]);
});

test("excludes blank and decorative block lines", () => {
  const metrics = metricsFor("/*\n * Real constraint.\n *\n * --------\n * Another detail.\n */\nconst value = 1;");
  assert.deepEqual([...metrics.commentLines], [2, 5]);
  assert.deepEqual([...metrics.codeLines], [7]);
});

test("excludes shebang and suppression directives from both sets", () => {
  const metrics = metricsFor("#!/usr/bin/env node\n// eslint-disable-next-line no-undef\nmissing();\n// @ts-ignore\nvalue.extra = true;");
  assert.deepEqual([...metrics.commentLines], []);
  assert.deepEqual([...metrics.codeLines], [3, 5]);
});

test("does not treat comment markers inside strings as comments", () => {
  const metrics = metricsFor("const url = 'https://example.com';\nconst marker = '/* text */';");
  assert.deepEqual([...metrics.codeLines], [1, 2]);
  assert.deepEqual([...metrics.commentLines], []);
});

/* A waiver answers a rule; it is not prose about the code. Charged to the density budget it made
   the escape cost a comment line, so a file at the budget could not take one without going over —
   the rule refusing the fix for its own escape (ISS-700). */
test("excludes a waiver from the comment lines it used to be charged to", () => {
  const waived = metricsFor("// pass-through: keep — the wrapper is the seam a test needs\nconst a = 1;");
  assert.deepEqual([...waived.commentLines], []);
  assert.deepEqual([...waived.codeLines], [2]);
  for (const line of [
    "// primitive: none — the token set has no name for this",
    "// restated: deliberate — the contrast is the point",
  ]) {
    assert.deepEqual([...metricsFor(`${line}\nconst a = 1;`).commentLines], [], line);
  }
  const unwaived = metricsFor("// pass-through: keep\nconst a = 1;");
  assert.deepEqual([...unwaived.commentLines], [1], "and a marker with no reason is still a comment");
});

/* The count a wrap cannot move. Blanks are the whole of what wrapping adds and removes, so they
   are the whole of what this leaves out; a waiver and a decorative line carry none of it either. */
test("comment characters count what is said, and nothing a wrap would move", () => {
  assert.equal(metricsFor("// rationale\nconst a = 1;").commentChars, 9);
  const prose = "one two three four five six seven eight nine ten";
  const oneLine = metricsFor(`// ${prose}\nconst a = 1;`).commentChars;
  const wrapped = metricsFor(`// one two three four five\n// six seven eight nine ten\nconst a = 1;`).commentChars;
  assert.equal(oneLine, wrapped, "the same words at two wrap columns");
  assert.equal(oneLine, prose.replace(/ /gu, "").length);
  const block = metricsFor("/*\n * Real constraint.\n *\n * --------\n * Another detail.\n */\nconst value = 1;");
  assert.equal(block.commentChars, "Realconstraint.--------Anotherdetail.".length);
  // The gutter asterisk is what a block comment gains by being wrapped, so a substantive one is
  // not counted either — the alternative is a count a wrap moves whenever it lands before a star.
  assert.equal(
    metricsFor("/* alpha * beta */\nconst a = 1;").commentChars,
    metricsFor("/* alpha\n * beta */\nconst a = 1;").commentChars,
    "an asterisk at a wrap boundary",
  );
  // A rule holds the divider too: nothing charges by which line a run of dashes ended up on.
  assert.equal(
    metricsFor("// a --- b\nconst a = 1;").commentChars,
    metricsFor("// a\n// --- b\nconst a = 1;").commentChars,
    "a decorative run at a wrap boundary",
  );
  assert.equal(metricsFor("// pass-through: keep — the wrapper is the seam a test needs\nconst a = 1;").commentChars, 0);
  assert.equal(metricsFor("#!/usr/bin/env node\nconst a = 1;").commentChars, 0);
});

/* A waiver's reason is prose and wraps like prose. Charged, the escape would cost whatever column
   its author broke the sentence at, which is the measure this unit exists to be rid of. */
test("a waiver costs nothing however its reason is wrapped", () => {
  const WAIVER = "// pass-through: keep — the wrapper is the seam a test needs and the seam is the point";
  assert.equal(metricsFor(`${WAIVER}\nconst a = 1;`).commentChars, 0);
  assert.equal(
    metricsFor("// pass-through: keep — the wrapper is the seam a test needs\n// and the seam is the point\nconst a = 1;").commentChars,
    0,
    "a reason on a second line is the same waiver",
  );
  // A comment trailing a line of code begins nothing, whatever stands above it.
  assert.equal(
    metricsFor("// pass-through: keep — the wrapper is the seam\nconst a = 1; // rationale\n").commentChars,
    9,
  );
  // And a blank line ends the waiver, so the prose under one is prose.
  assert.equal(
    metricsFor("// pass-through: keep — the wrapper is the seam\n\n// rationale\nconst a = 1;").commentChars,
    9,
  );
});

test("longest consecutive run finds the largest physical run", () => {
  assert.deepEqual(longestConsecutiveRun(new Set([1, 2, 4, 5, 6, 9])), [4, 5, 6]);
  assert.deepEqual(longestConsecutiveRun(new Set()), []);
});
