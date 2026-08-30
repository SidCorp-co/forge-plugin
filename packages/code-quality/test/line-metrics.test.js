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

test("longest consecutive run finds the largest physical run", () => {
  assert.deepEqual(longestConsecutiveRun(new Set([1, 2, 4, 5, 6, 9])), [4, 5, 6]);
  assert.deepEqual(longestConsecutiveRun(new Set()), []);
});
