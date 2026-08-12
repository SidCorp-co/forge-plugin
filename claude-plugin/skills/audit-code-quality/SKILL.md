---
name: audit-code-quality
description: Audit comments and god files with eslint-plugin-code-quality and report actionable findings. Use when the user asks to review comment quality, find historical narration, reduce comment density, or find oversized files, long functions, and crowded directories.
version: 0.6.0
---

# Audit code quality

Never ask which path to audit. Default to the whole project and let the numbers point at the scope.

1. Run the gate once, from the repository root:

   ```sh
   npx code-quality-gate
   ```

   One run covers the whole repository. With no `eslint.config.*` at the working directory the gate finds the packages below it and lints each with its own config, so a repo holding `frontend/` and `backend/` side by side needs one invocation, not two. It reports only this plugin's errors, plus crowded directories and form controls that cannot announce an error.

   `npm error 404 ... code-quality-gate is not in this registry` means the plugin is not installed in *this* directory, so npx reached the registry, where this package is not published. It is installed somewhere below — borrow the binary and keep the root as the working directory:

   ```sh
   ls */node_modules/.bin/code-quality-gate     # find one
   ./frontend/node_modules/.bin/code-quality-gate
   ```

   Never install anything to make the command resolve. Use `npx eslint <paths>` when the user named a scope, or when warnings matter because the project adopted a rule at `warn`.
2. Lead with the shape of the problem: total findings, a count per rule, and the worst files. Then go deep on the top few. Do not walk through every finding.
3. The command prints a directive for each rule that fired. Follow it verbatim so every audit lands on the same structure:
   - `max-lines` — split by responsibility, never at the line count. Backend: a folder per feature (routes, service, repository). Frontend: `components/`, `hooks/`, `lib/`. Move whole exports and re-export them from the original path so importers keep working.
   - `max-lines-per-function` — extract each independently testable step into a named function; split the file only if it then exceeds `max-lines`.
   - crowded directory — the same backend/frontend shape, applied to whole files. Split by responsibility, never alphabetically, and update the importers.
   - `comment-density` and `max-consecutive-comment-lines` — the report points at the densest block, not the file. Quote it; it is usually a few narrated runs rather than uniform noise.
   - `no-historical-narration` — the message quotes the phrase that matched. Replace it with the current constraint if that constraint is real; otherwise the comment goes.
   - inline error on a form control — wire the error into the control, or spread unknown props so a field wrapper can. Fixing is the default; see step 7 before reaching for a waiver.
4. Apply the comment findings yourself, in the same pass, without asking. No rule here has a fixer and `--fix` cannot touch a comment, so the judgement is yours to make — but it is a judgement, so it has a fixed shape:
   - Delete a comment that restates the code, narrates history, or points at another comment.
   - Shorten a comment that buries a real constraint in prose down to that constraint.
   - Never touch a license header, an ESLint directive, a TypeScript suppression, a shebang, or a comment recording a constraint the code cannot express. When in doubt whether a comment carries a constraint, keep it and say why.
5. Report comment edits after applying them, not before: one line per comment as `path:line` plus the deleted or replaced text, grouped by file. The user reviews the diff, so do not re-quote what is already visible there and do not ask for approval a second time.
6. Structural findings are the exception. A file split, a function extraction, or a directory reshuffle moves public paths and importers, so propose those and wait — the split directive in step 3 says what to propose.
7. Never clear a finding by raising a limit, adding a disable comment, or adding a file to an exemption list. Report it instead. A waiver is the single exception and is not yours to grant: `inline-warning: none — <reason>` asserts that a control will never carry validation, which is a claim about product intent that the code cannot settle. Propose the waiver with the reason you would write, and let the user decide. Never ignore a finding silently — an unwaived, unfixed control stays in the report.
8. Rerun the command on the changed files and report the exact result. Never claim a clean audit if ESLint had a setup, configuration, or parser error.
