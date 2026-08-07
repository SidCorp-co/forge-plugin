import commentDensity from "./comment-density.js";
import maxConsecutiveCommentLines from "./max-consecutive-comment-lines.js";
import noHistoricalNarration from "./no-historical-narration.js";

export const DEFAULT_MAX_FILE_CODE_LINES = 500;
export const DEFAULT_MAX_FUNCTION_CODE_LINES = 150;

// A suite callback is one function to ESLint, so the per-function cap would
// measure the suite instead of the test.
export const DEFAULT_TEST_GLOBS = [
  "**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "**/test/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "**/tests/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "**/__tests__/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
];

const plugin = {
  meta: { name: "eslint-plugin-code-quality", version: "0.2.0" },
  rules: {
    "no-historical-narration": noHistoricalNarration,
    "comment-density": commentDensity,
    "max-consecutive-comment-lines": maxConsecutiveCommentLines,
  },
  configs: {},
};

const comments = {
  name: "code-quality/comments",
  plugins: { "code-quality": plugin },
  rules: {
    "code-quality/no-historical-narration": "error",
    "code-quality/comment-density": ["error", { maxRatio: 0.15, minCommentLines: 0 }],
    "code-quality/max-consecutive-comment-lines": "error",
  },
};

/**
 * God-file limits, in code lines: comments and blanks are excluded so rationale
 * does not count as implementation breadth.
 */
export function godFilesConfig({
  maxFileCodeLines = DEFAULT_MAX_FILE_CODE_LINES,
  maxFunctionCodeLines = DEFAULT_MAX_FUNCTION_CODE_LINES,
  testGlobs = DEFAULT_TEST_GLOBS,
  severity = "error",
} = {}) {
  const configs = [
    {
      name: "code-quality/god-files",
      rules: {
        "max-lines": [severity, { max: maxFileCodeLines, skipBlankLines: true, skipComments: true }],
        "max-lines-per-function": [
          severity,
          { max: maxFunctionCodeLines, skipBlankLines: true, skipComments: true, IIFEs: true },
        ],
      },
    },
  ];

  if (testGlobs.length > 0) {
    configs.push({
      name: "code-quality/god-files-tests",
      files: [...testGlobs],
      rules: { "max-lines-per-function": "off" },
    });
  }
  return configs;
}

plugin.configs.comments = comments;
plugin.configs.godFiles = godFilesConfig();
plugin.configs.recommended = [comments, ...plugin.configs.godFiles];

export default plugin;
export const { configs, rules } = plugin;
