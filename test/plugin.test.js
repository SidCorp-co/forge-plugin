import assert from "node:assert/strict";
import test from "node:test";
import plugin, { configs, godFilesConfig, rules } from "../src/index.js";

const commentRules = {
  "code-quality/no-historical-narration": "error",
  "code-quality/comment-density": ["error", { maxRatio: 0.15, minCommentLines: 0 }],
  "code-quality/max-consecutive-comment-lines": "error",
};

test("exports all rules and a self-contained flat comments config", () => {
  assert.deepEqual(Object.keys(rules).sort(), [
    "comment-density",
    "max-consecutive-comment-lines",
    "no-historical-narration",
  ]);
  assert.equal(configs.comments.plugins["code-quality"], plugin);
  assert.deepEqual(configs.comments.rules, commentRules);
});

test("god-file config caps file and function code lines and exempts test suites", () => {
  const [limits, tests] = configs.godFiles;
  assert.deepEqual(limits.rules, {
    "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
    "max-lines-per-function": [
      "error",
      { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true },
    ],
  });
  assert.deepEqual(tests.rules, { "max-lines-per-function": "off" });
  assert.ok(tests.files.some((glob) => glob.includes("test")));
});

test("god-file limits are configurable", () => {
  const [limits, ...rest] = godFilesConfig({
    maxFileCodeLines: 250,
    maxFunctionCodeLines: 60,
    testGlobs: [],
    severity: "warn",
  });
  assert.deepEqual(limits.rules["max-lines"], [
    "warn",
    { max: 250, skipBlankLines: true, skipComments: true },
  ]);
  assert.equal(limits.rules["max-lines-per-function"][1].max, 60);
  assert.deepEqual(rest, []);
});

test("recommended combines the comment rules with the god-file limits", () => {
  assert.deepEqual(configs.recommended, [configs.comments, ...configs.godFiles]);
});
