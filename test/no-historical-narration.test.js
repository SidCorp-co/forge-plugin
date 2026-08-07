import { RuleTester } from "eslint";
import test from "node:test";
import rule, { isHistoricalNarration } from "../src/no-historical-narration.js";

const regressionComments = [
  "This used to use callbacks.",
  "Formerly initialized on demand.",
  "Previously this returned null.",
  "Before the refactor, this was synchronous.",
  "After migration this uses stable IDs.",
  "The old logic retried forever.",
  "The previous retry policy was unbounded.",
  "Updated implementation validates input.",
  "Kept for historical reference only.",
  "Copied from the worker package.",
  "No longer supports legacy IDs.",
  "This was API-only.",
  "M3 service agents handle this.",
  "Slice 12 owns validation.",
  "A sibling agent adds the route.",
  "Parallel agents update tests.",
  "A later agent wires this up.",
  "Service agents own persistence.",
  "The team lead will merge this.",
  "See above for details.",
  "Consult git history for context.",
];

test("all 21 current regression examples match", () => {
  for (const comment of regressionComments) {
    if (!isHistoricalNarration(comment)) throw new Error(`Did not match: ${comment}`);
  }
});

test("rule reports all 21 regression examples", () => {
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022 } });
  tester.run("no-historical-narration", rule, {
    valid: [
      "// Retry once because the provider can return a transient 409.\nconst retries = 1;",
      "#!/usr/bin/env node\nconst value = 1;",
      "// eslint-disable-next-line no-undef\nmissing();",
      "// @ts-expect-error third-party types omit this field\nvalue.extra = true;",
    ],
    invalid: regressionComments.map((comment) => ({
      code: `// ${comment}\nconst value = 1;`,
      errors: [{ messageId: "historicalNarration" }],
    })),
  });
});
