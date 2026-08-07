---
name: audit-code-quality
description: Audit JavaScript or TypeScript comments and god files with eslint-plugin-code-quality and explain actionable findings. Use when the user asks to review comment quality, find historical narration, reduce comment density, inspect long comment runs, or find oversized files and functions.
version: 0.2.0
---

# Audit code quality

Use the consumer project's local ESLint installation and configuration.

1. Confirm `eslint-plugin-code-quality` is present in the project's flat config. If not, use the setup skill first.
2. Run ESLint on the files or directory the user named. If no scope was named, ask before auditing the whole repository. To see only the blocking rules, run `code-quality-gate <paths>`.
3. Group findings by rule:
   - `no-historical-narration`: replace implementation history with the current constraint when that constraint is useful; otherwise remove the comment.
   - `comment-density`: remove narration the code already expresses, while retaining non-obvious constraints and system-boundary context.
   - `max-consecutive-comment-lines`: prefer clearer code or focused documentation over long inline comment walls.
   - `max-lines`: the file has taken on too many responsibilities. Propose a split along the seams the exports already suggest, not an arbitrary cut at the limit.
   - `max-lines-per-function`: extract the independently testable steps. A function this long can only be tested whole.
4. Never delete or rewrite a comment automatically. None of these rules ship a fixer, and `--fix` cannot touch a comment. Removing a comment is a judgement about what a future reader needs, so every comment change goes to the user as a proposal: quote the comment, say whether the constraint it records is still real, and let the user decide.
5. Do not mechanically strip license headers, ESLint directives, TypeScript suppressions, shebangs, or comments that explain a constraint the code cannot express. Do not raise a limit or add a file-level disable to clear a finding; report it instead.
6. Apply comment edits only for the specific comments the user approved, then rerun ESLint on the changed files. God-file splits are also proposals, not unrequested refactors.
7. Report remaining findings and the exact command result. Never claim a clean audit if ESLint had a setup, configuration, or parser error.
