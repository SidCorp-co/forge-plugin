import assert from "node:assert/strict";
import { RuleTester } from "eslint";
import test from "node:test";
import commentDensity from "../src/rules/comment-density.js";
import maxConsecutiveCommentLines from "../src/rules/max-consecutive-comment-lines.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022 } });

function source(commentCount, codeCount) {
  const comments = Array.from({ length: commentCount }, (_, i) => `// reason ${i + 1}`);
  const code = Array.from({ length: codeCount }, (_, i) => `const value${i + 1} = ${i + 1};`);
  return [...comments, ...code].join("\n");
}

/* One paragraph at four wrap columns, the same words each time. A budget in lines called the
   first of them valid and the last a finding, which is the wrap key answering the refusal, so the
   case is the whole of what the character unit is for (ISS-1937). */
const PARAGRAPH = Array.from(
  { length: 15 },
  () => "The unit is what the comment says and never the column its author wrapped it at.",
).join(" ");
const SHORT = Array.from({ length: 7 }, () => "A comment is measured by what it says.").join(" ");
const CODE = Array.from({ length: 20 }, (_, i) => `const value${i + 1} = ${i + 1};`).join("\n");

function wrapped(prose, columns) {
  const lines = [];
  for (const word of prose.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= columns - 3) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return `${lines.map((line) => `// ${line}`).join("\n")}\n${CODE}`;
}

const COLUMNS = [Number.MAX_SAFE_INTEGER, 100, 60, 40];

test("the same comment text measures the same at every wrap column", () => {
  tester.run("comment-density", commentDensity, {
    valid: COLUMNS.map((columns) => wrapped(SHORT, columns)),
    invalid: COLUMNS.map((columns) => ({
      code: wrapped(PARAGRAPH, columns),
      errors: [
        {
          message:
            "Cut 735 characters of comment, which a re-wrap will not: 20 code lines allow 240, this file has 975.",
        },
      ],
    })),
  });
});

const LONG = "a module states its one reason and this sentence costs more than one code line buys";

test("comment-density defaults and options", () => {
  tester.run("comment-density", commentDensity, {
    valid: [
      source(3, 20),
      source(1, 7),
      { code: source(2, 1), options: [{ maxChars: 20, minChars: 2 }] },
      {
        code: "const a = 1; // mixed\nconst b = 2; // mixed",
        options: [{ maxChars: 5 }],
      },
      // The floor is what a two-line module may carry, and it is not reached by the ratio here.
      { code: `// ${LONG}\nconst a = 1;`, options: [{ maxChars: 1, minChars: 68 }] },
    ],
    invalid: [
      {
        code: `// ${LONG}\nconst a = 1;`,
        errors: [
          {
            messageId: "excessiveDensity",
            // One code line buys 12 characters, and the sentence above it says 68.
            data: { excess: 56, budget: 12, chars: 68, codeLines: 1 },
          },
        ],
      },
      {
        code: source(2, 1),
        options: [{ maxChars: 5, minChars: 2 }],
        errors: [{ messageId: "excessiveDensity" }],
      },
      {
        code: "// one",
        errors: [{ messageId: "excessiveDensity" }],
      },
    ],
  });
});

/* The wrap a reviewer found: only whitespace moves, but the asterisk the second line gains is a
   block comment's gutter. Both readings of that pair reach the same verdict at both budgets. */
test("a block comment wrapped onto a gutter line reaches the same verdict", () => {
  const ONE_LINE = "/* alpha * beta */\nconst a = 1;";
  const WRAPPED = "/* alpha\n * beta */\nconst a = 1;";
  tester.run("comment-density", commentDensity, {
    valid: [ONE_LINE, WRAPPED].map((code) => ({ code, options: [{ maxChars: 9 }] })),
    invalid: [ONE_LINE, WRAPPED].map((code) => ({
      code,
      options: [{ maxChars: 8 }],
      errors: [{ messageId: "excessiveDensity", data: { excess: 1, budget: 8, chars: 9, codeLines: 1 } }],
    })),
  });
});

test("an option that counted lines is refused by name, with the one that counts characters", () => {
  for (const [retired, replacement] of [["maxRatio", "maxChars"], ["minCommentLines", "minChars"]]) {
    assert.throws(
      () => commentDensity.create({ options: [{ [retired]: 1 }], sourceCode: {} }),
      new RegExp(`comment-density: ${retired} counted comment lines.*Use ${replacement}`, "u"),
      `${retired} is taken silently`,
    );
  }
});

/* A file exactly at its budget takes its waiver and stays valid: the same source with one more
   comment line is the finding, so the case shows the waiver and not the slack (ISS-700). */
test("a file at the budget takes a waiver line and is still valid", () => {
  // Seven code lines buy 84 characters, and these twelve comment lines say exactly 84.
  const AT_BUDGET = [
    ...Array.from({ length: 12 }, (_, i) => `// reason ${String.fromCharCode(97 + i)}`),
    ...Array.from({ length: 7 }, (_, i) => `const value${i + 1} = ${i + 1};`),
  ].join("\n");
  tester.run("comment-density", commentDensity, {
    valid: [`// pass-through: keep — the wrapper is the seam a test needs\n${AT_BUDGET}`],
    invalid: [{ code: `// one more reason\n${AT_BUDGET}`, errors: [{ messageId: "excessiveDensity" }] }],
  });
});

test("comment-density reports on the densest block, not the whole program", () => {
  tester.run("comment-density", commentDensity, {
    valid: [],
    invalid: [
      {
        code:
          "const a = 1;\nconst b = 2;\n// the first line of the densest block in this file\n" +
          "// and the second line of that same block\nconst c = 3;",
        errors: [{ messageId: "excessiveDensity", line: 3, endLine: 4 }],
      },
    ],
  });
});

test("max-consecutive-comment-lines defaults and options", () => {
  tester.run("max-consecutive-comment-lines", maxConsecutiveCommentLines, {
    valid: [
      "// 1\n// 2\n// 3\n// 4\n// 5\n// 6\n// 7\n// 8\nconst x = 1;",
      "/*\n * 1\n * 2\n * ----\n * 3\n * 4\n */\nconst x = 1;",
      { code: "// 1\n// 2\nconst x = 1;", options: [{ max: 2 }] },
    ],
    invalid: [
      {
        code: "// 1\n// 2\n// 3\n// 4\n// 5\n// 6\n// 7\n// 8\n// 9\nconst x = 1;",
        errors: [{ messageId: "tooManyConsecutive", data: { count: 9, max: 8, excess: 1 } }],
      },
      {
        code: "const a = 1; // 1\nconst b = 2; // 2\nconst c = 3; // 3",
        options: [{ max: 2 }],
        errors: [{ messageId: "tooManyConsecutive" }],
      },
    ],
  });
});
