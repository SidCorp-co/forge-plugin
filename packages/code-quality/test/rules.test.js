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

test("comment-density defaults and options", () => {
  tester.run("comment-density", commentDensity, {
    valid: [
      source(3, 20),
      source(1, 7),
      { code: source(2, 1), options: [{ maxRatio: 2, minCommentLines: 2 }] },
      {
        code: "const a = 1; // mixed\nconst b = 2; // mixed",
        options: [{ maxRatio: 1, minCommentLines: 0 }],
      },
    ],
    invalid: [
      {
        code: source(1, 6),
        errors: [
          {
            messageId: "excessiveDensity",
            // 6 code lines at 0.15 buy no comment line at all, so the one written is the one to cut.
            data: { excess: 1, lineWord: "line", budget: 0, commentLines: 1, codeLines: 6, maxRatio: 0.15 },
          },
        ],
      },
      {
        code: source(2, 1),
        options: [{ maxRatio: 1, minCommentLines: 2 }],
        errors: [{ messageId: "excessiveDensity" }],
      },
      {
        code: "// one",
        errors: [{ messageId: "excessiveDensity" }],
      },
    ],
  });
});

test("comment-density reports on the densest block, not the whole program", () => {
  tester.run("comment-density", commentDensity, {
    valid: [],
    invalid: [
      {
        code: "const a = 1;\nconst b = 2;\n// one\n// two\nconst c = 3;",
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
