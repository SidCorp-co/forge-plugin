import commentDensity from "./comment-density.js";
import maxConsecutiveCommentLines from "./max-consecutive-comment-lines.js";
import noHistoricalNarration from "./no-historical-narration.js";

export {
  CROWDED_DIRECTORY_DIRECTIVE,
  directivesFor,
  FIX_POLICY,
  RULE_DIRECTIVES,
} from "./directives.js";
export { DESIGN_SYSTEM, findInlineWarningGaps } from "./inline-warning.js";
export {
  DEFAULT_IGNORED_DIRECTORIES,
  DEFAULT_MAX_FILES_PER_DIRECTORY,
  findCrowdedDirectories,
  SOURCE_EXTENSIONS,
} from "./folder-size.js";
export { HANDOFF_PATTERNS, NARRATION_PATTERNS } from "./no-historical-narration.js";

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
  meta: { name: "eslint-plugin-code-quality", version: "0.4.0" },
  rules: {
    "no-historical-narration": noHistoricalNarration,
    "comment-density": commentDensity,
    "max-consecutive-comment-lines": maxConsecutiveCommentLines,
  },
  configs: {},
};

export const DEFAULT_MAX_COMMENT_RATIO = 0.15;
export const DEFAULT_MAX_CONSECUTIVE_COMMENT_LINES = 8;

/**
 * Comment rules. `severity: "warn"` is how a project adopts these without
 * blocking the work already in flight.
 */
export function commentsConfig({
  maxRatio = DEFAULT_MAX_COMMENT_RATIO,
  minCommentLines = 0,
  maxConsecutiveCommentLines = DEFAULT_MAX_CONSECUTIVE_COMMENT_LINES,
  severity = "error",
  narration = {},
} = {}) {
  return {
    name: "code-quality/comments",
    plugins: { "code-quality": plugin },
    rules: {
      "code-quality/no-historical-narration": [severity, narration],
      "code-quality/comment-density": [severity, { maxRatio, minCommentLines }],
      "code-quality/max-consecutive-comment-lines": [
        severity,
        { max: maxConsecutiveCommentLines },
      ],
    },
  };
}

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

plugin.configs.comments = commentsConfig();
plugin.configs.godFiles = godFilesConfig();
plugin.configs.recommended = [plugin.configs.comments, ...plugin.configs.godFiles];

/**
 * Every rule at `warn`, for the first weeks in a project that has never run
 * these checks. The findings are the same; only the exit code differs.
 */
plugin.configs.adopting = [
  commentsConfig({ severity: "warn" }),
  ...godFilesConfig({ severity: "warn" }),
];

/**
 * The rule ids a config actually enables, for callers that gate a build on this
 * plugin's findings without inheriting every other rule the project runs.
 */
export function enabledRuleIds(configs = plugin.configs.recommended) {
  const ids = new Set();
  for (const config of configs) {
    for (const [id, entry] of Object.entries(config.rules ?? {})) {
      const severity = Array.isArray(entry) ? entry[0] : entry;
      if (severity !== "off" && severity !== 0) ids.add(id);
    }
  }
  return ids;
}

export default plugin;
export const { configs, rules } = plugin;
