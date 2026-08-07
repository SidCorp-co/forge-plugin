import { getLineMetrics } from "./line-metrics.js";

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit comment lines relative to code lines", recommended: true },
    schema: [
      {
        type: "object",
        properties: {
          maxRatio: { type: "number", minimum: 0 },
          minCommentLines: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      excessiveDensity:
        "Comment density is {{ratio}} ({{commentLines}} comment lines / {{codeLines}} code lines), exceeding the maximum {{maxRatio}}.",
    },
  },
  create(context) {
    const { maxRatio = 0.15, minCommentLines = 0 } = context.options[0] ?? {};
    return {
      "Program:exit"(node) {
        const metrics = getLineMetrics(context.sourceCode);
        if (metrics.commentLines.size < minCommentLines) return;
        const ratio = metrics.codeLines.size === 0 ? Number.POSITIVE_INFINITY : metrics.commentLines.size / metrics.codeLines.size;
        if (ratio <= maxRatio) return;
        context.report({
          node,
          messageId: "excessiveDensity",
          data: {
            ratio: Number.isFinite(ratio) ? ratio.toFixed(2) : "Infinity",
            commentLines: metrics.commentLines.size,
            codeLines: metrics.codeLines.size,
            maxRatio,
          },
        });
      },
    };
  },
};
