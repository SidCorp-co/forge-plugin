import commentDensity from "./comment-density.js";
import noArbitrarySizes from "./design/no-arbitrary-sizes.js";
import noRawColors from "./design/no-raw-colors.js";
import maxConsecutiveCommentLines from "./max-consecutive-comment-lines.js";
import noHistoricalNarration from "./no-historical-narration.js";
import noPassThroughWrapper from "./no-pass-through-wrapper.js";

export { DEFAULT_CONTRAST_THRESHOLDS, findContrastFailures } from "./design/contrast.js";
export {
  DEFAULT_INTERACTIVE,
  DEFAULT_INTERACTIVE_SIZE_FAMILIES,
  DEFAULT_SIZE_FAMILIES,
  DEFAULT_SIZE_UNITS,
  findArbitrarySizesInFiles,
} from "./design/no-arbitrary-sizes.js";
export {
  DEFAULT_RAMP_COMPANIONS,
  DEFAULT_RAMP_PREFIX,
  findRampGaps,
  TYPE_RAMP_DIRECTIVE,
} from "./design/type-ramp.js";
export { findRawColorsInFiles } from "./design/no-raw-colors.js";
export {
  COLOR_PROPERTIES,
  contrastRatio,
  DEFAULT_MARKUP_EXTENSIONS,
  DEFAULT_STYLESHEET_EXTENSIONS,
  findRawColors,
  NAMED_COLORS,
  NEUTRAL_COLOR_KEYWORDS,
  readColorTokens,
  readTokenSources,
  resolveTokenAliases,
  sourceFiles,
} from "./design/tokens.js";

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
  meta: { name: "eslint-plugin-code-quality", version: "0.6.0" },
  rules: {
    "no-historical-narration": noHistoricalNarration,
    "comment-density": commentDensity,
    "max-consecutive-comment-lines": maxConsecutiveCommentLines,
    "no-pass-through-wrapper": noPassThroughWrapper,
    "no-raw-colors": noRawColors,
    "no-arbitrary-sizes": noArbitrarySizes,
  },
  configs: {},
};

export const DEFAULT_MAX_COMMENT_RATIO = 0.15;
export const DEFAULT_MAX_CONSECUTIVE_COMMENT_LINES = 8;

/** Every rule this plugin can enable, and the options it enables one with. */
const RULE_OPTIONS = {
  "no-historical-narration": {},
  "comment-density": { maxRatio: DEFAULT_MAX_COMMENT_RATIO, minCommentLines: 0 },
  "max-consecutive-comment-lines": { max: DEFAULT_MAX_CONSECUTIVE_COMMENT_LINES },
  "no-pass-through-wrapper": {},
  "no-raw-colors": {},
  "no-arbitrary-sizes": {},
  "max-lines": { max: DEFAULT_MAX_FILE_CODE_LINES, skipBlankLines: true, skipComments: true },
  "max-lines-per-function": {
    max: DEFAULT_MAX_FUNCTION_CODE_LINES,
    skipBlankLines: true,
    skipComments: true,
    IIFEs: true,
  },
};

/** ESLint's own two, so they carry no namespace and a project copy silently replaces them. */
const CORE_RULES = new Set(["max-lines", "max-lines-per-function"]);

/** Meaningless without a token layer: every `#fff` would report. Off until `tokens` names one. */
const TOKEN_RULES = new Set(["no-raw-colors", "no-arbitrary-sizes"]);

/** What the gate blocks on, and the only ids `configure` answers to. */
export const RULE_IDS = Object.keys(RULE_OPTIONS).map((name) =>
  CORE_RULES.has(name) ? name : `code-quality/${name}`,
);

/**
 * The whole flat config, from one severity per rule. `"error"`, `"warn"` and `"off"`, or
 * `["warn", { …options }]` to tune one; anything unnamed is `"error"`, the token rules
 * excepted. `tokens` names the file colours and sizes belong in and exempts it from both.
 */
export function configure({ tokens, testGlobs = DEFAULT_TEST_GLOBS, ignores, ...asked } = {}) {
  const unknown = Object.keys(asked).filter((name) => !(name in RULE_OPTIONS));
  if (unknown.length > 0) {
    throw new TypeError(`configure: no rule named ${unknown.join(", ")}`);
  }

  // The token file exempts itself from the rules that would report every line of it.
  const shared =
    tokens === undefined
      ? undefined
      : {
          ...(tokens.tokenSource === undefined ? {} : { tokenSource: tokens.tokenSource }),
          exemptFiles: [
            ...new Set([tokens.tokenSource, ...(tokens.exemptFiles ?? [])].filter(Boolean)),
          ],
        };

  const rules = {};
  for (const [name, defaults] of Object.entries(RULE_OPTIONS)) {
    const wanted = asked[name] ?? (TOKEN_RULES.has(name) && shared === undefined ? "off" : "error");
    const [severity, options = {}] = Array.isArray(wanted) ? wanted : [wanted];
    if (severity === "off" || severity === 0) continue;
    const token = TOKEN_RULES.has(name) && shared !== undefined;
    rules[CORE_RULES.has(name) ? name : `code-quality/${name}`] = [
      severity,
      {
        ...defaults,
        ...(token ? shared : {}),
        ...options,
        // Per-rule exemptions are added to the token file's, never swapped for it.
        ...(token
          ? { exemptFiles: [...new Set([...shared.exemptFiles, ...(options.exemptFiles ?? [])])] }
          : {}),
      },
    ];
  }

  const configs = [{ name: "code-quality", plugins: { "code-quality": plugin }, rules }];
  if (ignores !== undefined) configs.unshift({ name: "code-quality/ignores", ignores });
  if (rules["max-lines-per-function"] !== undefined && testGlobs.length > 0) {
    configs.push({
      name: "code-quality/tests",
      files: [...testGlobs],
      rules: { "max-lines-per-function": "off" },
    });
  }
  return configs;
}

plugin.configs.recommended = configure();

export default plugin;
export const { configs, rules } = plugin;
