import assert from "node:assert/strict";
import test from "node:test";
import plugin, { configs, configure, RULE_IDS, rules } from "../src/index.js";

const severityOf = (config, id) => {
  const entry = config.rules[id];
  return Array.isArray(entry) ? entry[0] : entry;
};

test("exports every rule, and one id per rule for the gate to block on", () => {
  assert.deepEqual(Object.keys(rules).sort(), [
    "comment-density",
    "max-consecutive-comment-lines",
    "no-arbitrary-sizes",
    "no-historical-narration",
    "no-pass-through-wrapper",
    "no-raw-colors",
    "no-raw-elements",
  ]);
  assert.deepEqual([...RULE_IDS].sort(), [
    "code-quality/comment-density",
    "code-quality/max-consecutive-comment-lines",
    "code-quality/no-arbitrary-sizes",
    "code-quality/no-historical-narration",
    "code-quality/no-pass-through-wrapper",
    "code-quality/no-raw-colors",
    "code-quality/no-raw-elements",
    "max-lines",
    "max-lines-per-function",
  ]);
});

test("no-raw-elements waits for a design system, and the section is what names one", () => {
  const [waiting] = configure();
  assert.equal("code-quality/no-raw-elements" in waiting.rules, false);

  // A design system turns it on the way a token layer turns the other two on.
  const [named] = configure({
    primitives: { source: "src/components/ui", importPath: "@/components/ui" },
  });
  assert.deepEqual(named.rules["code-quality/no-raw-elements"], [
    "error",
    { source: "src/components/ui", importPath: "@/components/ui" },
  ]);

  // Options beside the severity tune the section rather than being replaced by it.
  const [tuned] = configure({
    primitives: { source: "src/components/ui", rampClasses: ["fg-"] },
    "no-raw-elements": ["warn", { rampClasses: ["type-"] }],
  });
  assert.deepEqual(tuned.rules["code-quality/no-raw-elements"], [
    "warn",
    { rampClasses: ["type-"], source: "src/components/ui" },
  ]);

  // Asked for without a section: on, with the default map and no source to narrow it.
  const [asked] = configure({ "no-raw-elements": "error" });
  assert.deepEqual(asked.rules["code-quality/no-raw-elements"], ["error", {}]);

  // A raw control in a test is a stub standing in for a screen, so tests are relaxed from it
  // in the same block that relaxes the per-function cap.
  const [, tests] = configure({ primitives: { source: "src/components/ui" } });
  assert.deepEqual(tests.rules, {
    "max-lines-per-function": "off",
    "code-quality/no-raw-elements": "off",
  });
});

test("an unnamed rule is an error, and the design rules wait for a token layer", () => {
  const [main, tests] = configure();
  assert.equal(main.plugins["code-quality"], plugin);
  assert.deepEqual(main.rules, {
    "code-quality/no-historical-narration": ["error", {}],
    "code-quality/comment-density": ["error", { maxRatio: 0.15, minCommentLines: 0 }],
    "code-quality/max-consecutive-comment-lines": ["error", { max: 8 }],
    "code-quality/no-pass-through-wrapper": ["error", {}],
    "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
    "max-lines-per-function": [
      "error",
      { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true },
    ],
  });

  // A suite callback is one function to ESLint, so the per-function cap is off in tests.
  assert.deepEqual(tests.rules, { "max-lines-per-function": "off" });
  assert.ok(tests.files.some((glob) => glob.includes("test")));
  assert.deepEqual(configs.recommended, configure());
});

test("one severity per rule, and options travel beside it", () => {
  const [main, ...rest] = configure({
    "comment-density": ["warn", { maxRatio: 0.3, minCommentLines: 6 }],
    "no-historical-narration": ["warn", { handoffNarration: false }],
    "max-lines": ["error", { max: 250 }],
    "no-pass-through-wrapper": "off",
    "max-lines-per-function": "off",
  });
  assert.deepEqual(main.rules["code-quality/comment-density"], [
    "warn",
    { maxRatio: 0.3, minCommentLines: 6 },
  ]);
  assert.deepEqual(main.rules["code-quality/no-historical-narration"], [
    "warn",
    { handoffNarration: false },
  ]);
  // Tuning one option keeps the defaults beside it, so a raised cap never drops skipComments.
  assert.deepEqual(main.rules["max-lines"], [
    "error",
    { max: 250, skipBlankLines: true, skipComments: true },
  ]);
  assert.equal("code-quality/no-pass-through-wrapper" in main.rules, false);
  // No per-function cap left to relax, so no test override either.
  assert.deepEqual(rest, []);

  assert.deepEqual(configure({ testGlobs: [] }).length, 1);
  assert.deepEqual(configure({ ignores: ["dist/**"] })[0], {
    name: "code-quality/ignores",
    ignores: ["dist/**"],
  });
});

test("a token layer turns the design rules on and exempts itself from them", () => {
  const [main] = configure({
    tokens: { tokenSource: "app/globals.css", exemptFiles: ["src/legacy/**"] },
    "no-arbitrary-sizes": ["warn", { units: ["px"] }],
  });
  const exemptFiles = ["app/globals.css", "src/legacy/**"];
  assert.deepEqual(main.rules["code-quality/no-raw-colors"], [
    "error",
    { tokenSource: "app/globals.css", exemptFiles },
  ]);
  // A rule given exemptions of its own keeps the token file's, or the token file reports on
  // every declaration it is the source of truth for.
  assert.deepEqual(main.rules["code-quality/no-arbitrary-sizes"], [
    "warn",
    { tokenSource: "app/globals.css", exemptFiles, units: ["px"] },
  ]);

  const [without] = configure();
  assert.equal("code-quality/no-raw-colors" in without.rules, false);
  assert.equal("code-quality/no-arbitrary-sizes" in without.rules, false);
});

test("every rule can be warned on, and a misspelled one is a throw rather than a default", () => {
  const asWarnings = Object.fromEntries(
    RULE_IDS.map((id) => [id.replace("code-quality/", ""), "warn"]),
  );
  const [main] = configure({ ...asWarnings, tokens: { tokenSource: "app/globals.css" } });
  assert.deepEqual(
    [...new Set(RULE_IDS.map((id) => severityOf(main, id)))],
    ["warn"],
    "every rule this plugin owns must be adoptable without blocking the work in flight",
  );

  assert.throws(() => configure({ "comment-densty": "warn" }), /no rule named comment-densty/);
});
