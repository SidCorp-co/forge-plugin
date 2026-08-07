import { getLineMetrics, longestConsecutiveRun } from "./line-metrics.js";

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit consecutive physical comment lines", recommended: true },
    schema: [
      {
        type: "object",
        properties: { max: { type: "integer", minimum: 0 } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyConsecutive:
        "{{count}} consecutive comment lines exceed the maximum {{max}}. Keep comments focused on the current constraint.",
    },
  },
  create(context) {
    const { max = 8 } = context.options[0] ?? {};
    return {
      "Program:exit"() {
        const run = longestConsecutiveRun(getLineMetrics(context.sourceCode).commentLines);
        if (run.length <= max) return;
        context.report({
          loc: {
            start: { line: run[0], column: 0 },
            end: { line: run.at(-1), column: context.sourceCode.lines[run.at(-1) - 1].length },
          },
          messageId: "tooManyConsecutive",
          data: { count: run.length, max },
        });
      },
    };
  },
};
