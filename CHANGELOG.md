# Changelog

All notable changes to this package are documented here.

## 0.4.0 - 2026-08-07

### Added

- `no-historical-narration` takes options: `handoffNarration` to switch off the multi-agent phrasing group, `additionalPatterns` for project vocabulary, and `allowPatterns` for references a reader needs. `NARRATION_PATTERNS` and `HANDOFF_PATTERNS` are exported.
- `commentsConfig()`, matching `godFilesConfig()`, for ratio, run length, severity, and narration options.
- `configs.adopting`: every rule at `warn`, for a project running these checks for the first time.
- `code-quality-gate --help`, `--ignore-dir=`, and `--ext=`; `findCrowdedDirectories` takes `extensions`.
- The package now lints itself with its own recommended config.
- Directives: a failing gate or hook report closes with the remedy for the rules that fired, plus one policy line ruling out `eslint-disable`, a raised limit, and an exemption entry. `max-lines` and a crowded directory get the same split shape — backend to a folder per feature, frontend to `components/`, `hooks/`, `lib/` — so both surfaces land on one structure. Exported as `FIX_POLICY`, `RULE_DIRECTIVES`, `CROWDED_DIRECTORY_DIRECTIVE`, and `directivesFor()`.
- `findNarration()`, the phrase-level counterpart to `isHistoricalNarration()`.
- The gate fails when a design-system form control cannot announce its error at the control — a closed prop list that a field wrapper's `cloneElement` injection cannot reach. Waive one with `inline-warning: none — <reason>`; the reason is required and every waiver prints. `--no-inline-warning` and `--inline-warning-all` narrow it, `findInlineWarningGaps()` exports it. Worktrees are never scanned, by the walk or by an explicit root.

### Changed

- The gate blocks on errors only. A rule the project sets to `warn` is reported by `eslint` but does not fail the gate.
- The edit hook lints the workspace that owns the file, so a monorepo package uses its own ESLint config and install, and it no longer passes `--max-warnings 0`.
- **Breaking:** `DEFAULT_MAX_FILES_PER_DIRECTORY` is 10, down from 20. A project that wants the old width passes `--max-files-per-dir=20` or `findCrowdedDirectories({ max: 20 })`.
- `no-historical-narration` quotes the phrase that matched, so a report is actionable without reopening the file.
- `comment-density` reports on the longest run of comment lines instead of the whole program, and its message now names the deletion to make.
- The crowded-directory report prints its directive once beneath the list rather than repeating it per directory.
- `/code-quality:audit-code-quality` applies comment findings directly and reports what it removed, instead of proposing each one and waiting. The protected list — license headers, ESLint directives, TypeScript suppressions, shebangs, and comments recording a constraint the code cannot express — is unchanged, and structural findings are still proposed rather than applied.

## 0.3.0 - 2026-08-07

### Added

- `enabledRuleIds()`, used by `code-quality-gate` to derive its blocking set from the configs instead of a hand-maintained list.
- `findCrowdedDirectories`, `DEFAULT_MAX_FILES_PER_DIRECTORY`, and `SOURCE_EXTENSIONS` are exported, so the directory-width check is usable from code and not only from the CLI.

### Changed

- `code-quality-gate` accepts `--max-files-per-dir=N` only; the separate-argument form is gone.
- Directory-width results carry `directory` and `count` only.
- Line metrics are computed once per file and shared by both comment rules.

## 0.2.1 - 2026-08-07

### Changed

- The edit hook exits quietly in a project that has no ESLint installed instead of reporting a setup failure. The plugin is installed per user, so it must stay silent in projects that never adopted it.

## 0.2.0 - 2026-08-07

### Added

- `godFilesConfig()` and the `godFiles` flat config: `max-lines` at 500 code lines, `max-lines-per-function` at 150 code lines, both excluding comments and blank lines, plus a test-file override that drops the per-function limit.
- `code-quality-gate` bin: lints the project and fails only on the god-file and comment rules.
- `comments` flat config for the three comment rules on their own.

### Changed

- Package renamed to `eslint-plugin-code-quality`; the plugin namespace, the Claude Code plugin, and its marketplace are now `code-quality`.
- `configs.recommended` is an array (`comments` plus the god-file configs) and must be spread into a flat config.
- Claude Code skills renamed to `setup-code-quality` and `audit-code-quality`; the audit skill treats every comment change as a proposal for review.

## 0.1.0 - 2026-08-07

### Added

- `no-historical-narration` rule with the expanded primary-repository patterns.
- `comment-density` rule with parser-aware physical-line metrics and a strict 0.15 default ratio without a comment-line floor.
- `max-consecutive-comment-lines` rule.
- Flat recommended configuration.
