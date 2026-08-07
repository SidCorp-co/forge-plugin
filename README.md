# eslint-plugin-code-quality

ESLint rules and flat configs for two related limits: comments that record current constraints rather than implementation history, and files and functions that stay small enough to read, test, and move.

## Requirements

- Node.js 20 or newer
- ESLint 9 or 10

## Install

From a local checkout:

```sh
npm install --save-dev eslint file:/absolute/path/to/eslint-plugin-code-quality
```

After the package is published, replace the `file:` dependency with `eslint-plugin-code-quality`.

## Flat config

```js
import codeQuality from "eslint-plugin-code-quality";

export default [...codeQuality.configs.recommended];
```

`configs.recommended` is an array, so spread it. It contains:

| Config | Contents |
| --- | --- |
| `configs.comments` | the three comment rules under the `code-quality` namespace |
| `configs.godFiles` | `max-lines` and `max-lines-per-function`, plus a test-file override |
| `configs.recommended` | `comments` followed by `godFiles` |

## God-file limits

```js
{
  "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }]
}
```

These are ESLint's own rules with tuned options, not reimplementations. Comments and blank lines are excluded, so the limits measure implementation breadth and a file is never penalised for explaining itself. Test files keep the file limit but not the per-function limit, because a `describe` callback is a single function to ESLint and capping it would reward fewer, larger test cases.

Use `godFilesConfig` for different limits:

```js
import codeQuality, { godFilesConfig } from "eslint-plugin-code-quality";

export default [
  codeQuality.configs.comments,
  ...godFilesConfig({ maxFileCodeLines: 300, maxFunctionCodeLines: 80, severity: "warn" }),
];
```

Options are `maxFileCodeLines` (default 500), `maxFunctionCodeLines` (default 150), `testGlobs` (pass `[]` to skip the test override), and `severity`.

For legacy files that cannot be split yet, add an explicit override listing those exact files rather than disabling the rule for a directory. A list that may only shrink keeps the debt visible.

## Comment rules

None of these rules has a fixer. `eslint --fix` cannot delete or rewrite a comment, and that is deliberate: whether a comment still earns its place is a judgement about future readers, so every removal should be reviewed by a person.

### `no-historical-narration`

Rejects comments that describe old implementations, migration history, cross-agent handoffs, commit history, or redundant cross-references. ESLint control comments, TypeScript suppression comments, and shebangs are ignored.

### `comment-density`

Limits physical comment lines relative to physical code lines.

```js
{
  "code-quality/comment-density": ["error", {
    maxRatio: 0.15,
    minCommentLines: 0
  }]
}
```

A mixed line containing both code and a substantive comment belongs to both sets. Blank or decorative block-comment lines do not count. The recommended config measures every file with substantive comments and permits at most 15 comment lines per 100 code lines.

### `max-consecutive-comment-lines`

Limits runs of adjacent substantive comment lines.

```js
{
  "code-quality/max-consecutive-comment-lines": ["error", { max: 8 }]
}
```

Mixed lines count as comment lines. Blank and decorative block-comment lines break a run.

## CI gate

The package installs a `code-quality-gate` bin. It lints the project with its own ESLint configuration and fails only on the blocking rules — `max-lines`, `max-lines-per-function`, and the three `code-quality/*` rules — so unrelated findings stay visible without gating a build.

```json
{
  "scripts": {
    "lint:god-files": "code-quality-gate"
  }
}
```

Pass paths to narrow the scope: `code-quality-gate src test`.

### Directory width

The gate also fails when a directory holds more than 20 source files of its own, because a flat folder with fifty modules gives a reader no structure to navigate by. Subdirectories are counted separately — the crowded folder is the finding, and splitting it by responsibility is the fix. Build output, dependencies, and dot directories are skipped.

```sh
code-quality-gate --max-files-per-dir=30
code-quality-gate --no-folder-check
```

This is a gate check rather than an ESLint rule on purpose. ESLint sees one file at a time, so a directory-width rule would report the same finding once per file in the folder and would fire on every edit the Claude Code hook lints.

## Claude Code plugin

This package also contains a self-contained Claude Code plugin in `claude-plugin/` and a local marketplace manifest at `.claude-plugin/marketplace.json`.

Add the marketplace and install the plugin from this checkout:

```sh
claude plugin marketplace add .
claude plugin install code-quality@code-quality-local
```

Restart Claude Code after installation. Run `/code-quality:setup-code-quality` in a Node project to install the project's local `eslint` and `eslint-plugin-code-quality` dependencies and append the recommended flat config. Use `/code-quality:audit-code-quality` for a scoped audit; it proposes comment changes for review instead of applying them.

### Edit hook behavior

The `PostToolUse` hook runs after `Edit`, `Write`, `MultiEdit`, and `NotebookEdit`. It:

- reads the hook event as JSON from standard input;
- resolves relative paths against `CLAUDE_PROJECT_DIR`, then the event `cwd`;
- ignores unsupported extensions and missing, deleted, directory, symlink, or out-of-project paths;
- resolves `eslint` from the consumer project's own `node_modules` without `npx`, downloads, or a shell;
- runs ESLint only on the changed file with the consumer's existing configuration and cache disabled;
- exits `0` when clean or non-applicable and `2` with concise diagnostics for lint, setup, configuration, or parser failures.

The hook only reports. It never edits a file, never runs `--fix`, and never installs anything.

Supported extensions are `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts`. The hook does not install dependencies or manufacture an ESLint config. This keeps behavior deterministic when Claude Code installs the plugin in a versioned cache directory.

Validate the marketplace and plugin manifests with:

```sh
npm run plugin:validate
```

## Development

```sh
npm test
npm run lint
npm run pack:check
npm pack --dry-run
```

## License

MIT
