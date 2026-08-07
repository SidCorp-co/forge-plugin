import type { ESLint, Linter } from "eslint";

export declare const DEFAULT_MAX_FILE_CODE_LINES: number;
export declare const DEFAULT_MAX_FUNCTION_CODE_LINES: number;
export declare const DEFAULT_MAX_COMMENT_RATIO: number;
export declare const DEFAULT_MAX_CONSECUTIVE_COMMENT_LINES: number;
export declare const DEFAULT_TEST_GLOBS: string[];

export type Severity = "error" | "warn" | "off";

export interface NarrationOptions {
  /** Patterns aimed at the next agent or migration stage. Default `true`. */
  handoffNarration?: boolean;
  /** Extra case-insensitive source patterns to reject. */
  additionalPatterns?: string[];
  /** Case-insensitive source patterns that exempt a comment. */
  allowPatterns?: string[];
}

export interface CommentsOptions {
  maxRatio?: number;
  minCommentLines?: number;
  maxConsecutiveCommentLines?: number;
  severity?: Severity;
  narration?: NarrationOptions;
}

export interface GodFilesOptions {
  maxFileCodeLines?: number;
  maxFunctionCodeLines?: number;
  testGlobs?: string[];
  severity?: Severity;
}

export declare function commentsConfig(options?: CommentsOptions): Linter.Config;
export declare function godFilesConfig(options?: GodFilesOptions): Linter.Config[];
export declare function enabledRuleIds(configs?: Linter.Config[]): Set<string>;

export declare const NARRATION_PATTERNS: RegExp[];
export declare const HANDOFF_PATTERNS: RegExp[];

export declare const FIX_POLICY: string;
export declare const RULE_DIRECTIVES: Record<string, string>;
export declare const CROWDED_DIRECTORY_DIRECTIVE: string;
/** The unique remedy lines for the given rule ids, in first-seen order. */
export declare function directivesFor(ruleIds: Iterable<string>): string[];

export declare const DEFAULT_MAX_FILES_PER_DIRECTORY: number;
export declare const DEFAULT_IGNORED_DIRECTORIES: Set<string>;
export declare const SOURCE_EXTENSIONS: Set<string>;

export interface CrowdedDirectory {
  directory: string;
  count: number;
}

export declare function findCrowdedDirectories(options?: {
  roots?: string[];
  max?: number;
  ignoredDirectories?: Set<string>;
  extensions?: Set<string>;
}): CrowdedDirectory[];

export interface InlineWarningFinding {
  file: string;
  line?: number;
  component: string;
  reason: string;
}

export declare const DESIGN_SYSTEM: RegExp;

/** Form controls that cannot announce an error at the control. Worktrees are never scanned. */
export declare function findInlineWarningGaps(options?: {
  roots?: string[];
  /** Judge feature screens too, not the design system alone. */
  all?: boolean;
}): {
  files: string[];
  controlCount: number;
  waivers: InlineWarningFinding[];
  violations: InlineWarningFinding[];
};

declare const plugin: ESLint.Plugin;

export default plugin;
export const configs: NonNullable<ESLint.Plugin["configs"]>;
export const rules: NonNullable<ESLint.Plugin["rules"]>;
