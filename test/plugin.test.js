import assert from "node:assert/strict";
import test from "node:test";
import plugin, { commentsConfig, configs, enabledRuleIds, godFilesConfig, rules } from "../src/index.js";

const commentRules = {
  "code-quality/no-historical-narration": ["error", {}],
  "code-quality/comment-density": ["error", { maxRatio: 0.15, minCommentLines: 0 }],
  "code-quality/max-consecutive-comment-lines": ["error", { max: 8 }],
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

test("comment limits are configurable, and adopting downgrades every rule", () => {
  const relaxed = commentsConfig({
    maxRatio: 0.3,
    maxConsecutiveCommentLines: 20,
    severity: "warn",
    narration: { handoffNarration: false },
  });
  assert.deepEqual(relaxed.rules, {
    "code-quality/no-historical-narration": ["warn", { handoffNarration: false }],
    "code-quality/comment-density": ["warn", { maxRatio: 0.3, minCommentLines: 0 }],
    "code-quality/max-consecutive-comment-lines": ["warn", { max: 20 }],
  });

  const severities = configs.adopting.flatMap((config) =>
    Object.values(config.rules).map((entry) => (Array.isArray(entry) ? entry[0] : entry)),
  );
  assert.deepEqual([...new Set(severities)].sort(), ["off", "warn"]);
});

test("enabled rule ids cover every rule recommended turns on", () => {
  assert.deepEqual(
    [...enabledRuleIds()].sort(),
    [
      "code-quality/comment-density",
      "code-quality/max-consecutive-comment-lines",
      "code-quality/no-historical-narration",
      "max-lines",
      "max-lines-per-function",
    ],
  );
  assert.deepEqual([...enabledRuleIds([{ rules: { a: "off", b: ["error"], c: 0 } }])], ["b"]);
});
