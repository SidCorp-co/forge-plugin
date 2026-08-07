# Changelog

All notable changes to this package are documented here.

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
