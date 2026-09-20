import { getLineMetrics, longestConsecutiveRun } from "../line-metrics.js";

/* What each retired option counted, and the one that replaces it. Both measured lines, which the
   author chooses for free by where the text is wrapped, so neither can be translated silently. */
const RETIRED = {
  maxRatio:
    "maxChars, the comment characters a code line buys; the old 0.15 of a 100-column line is maxChars: 12",
  minCommentLines: "minChars, the smallest budget a file gets whatever its length, in those same characters",
};

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit comment content relative to code lines", recommended: true },
    schema: [
      {
        type: "object",
        properties: {
          maxChars: { type: "number", minimum: 0 },
          minChars: { type: "integer", minimum: 0 },
          maxRatio: {},
          minCommentLines: {},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      excessiveDensity:
        "Cut {{excess}} non-blank characters of comment, which a re-wrap will not: {{codeLines}} code lines allow {{budget}}, this file has {{chars}}.",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    for (const [retired, replacement] of Object.entries(RETIRED)) {
      if (retired in options) {
        throw new TypeError(
          `comment-density: ${retired} counted comment lines, which a re-wrap moves. Use ${replacement}.`,
        );
      }
    }
    const { maxChars = 12, minChars = 0 } = options;
    return {
      "Program:exit"(node) {
        const metrics = getLineMetrics(context.sourceCode);
        // The floor is under the budget rather than in front of the report, so a module too short
        // to buy a sentence is answered with what it may carry instead of going unmeasured.
        const budget = Math.max(minChars, Math.floor(maxChars * metrics.codeLines.size));
        if (metrics.commentChars <= budget) return;
        // The densest block is where the deletions are, so the report points
        // there rather than at the program node the ratio was computed over.
        const run = longestConsecutiveRun(metrics.commentLines);
        const loc = run.length === 0
          ? node.loc
          : {
              start: { line: run[0], column: 0 },
              end: { line: run.at(-1), column: context.sourceCode.lines[run.at(-1) - 1].length },
            };
        context.report({
          loc,
          messageId: "excessiveDensity",
          data: {
            excess: metrics.commentChars - budget,
            budget,
            chars: metrics.commentChars,
            codeLines: metrics.codeLines.size,
          },
        });
      },
    };
  },
};
