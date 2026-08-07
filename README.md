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
| `configs.adopting` | the same rules, every one at `warn` |

Nothing here assumes a framework, a directory layout, or TypeScript. The rules work on whatever ESLint can parse; bring your own parser for TypeScript or JSX and spread these configs after it.

## Adopting in an existing project

A codebase that has never run these checks will light up on the first run. Start with `configs.adopting`, which reports everything at `warn`:

```js
export default [...codeQuality.configs.adopting];
```

Warnings do not fail `code-quality-gate` and do not block the Claude Code edit hook, so the findings are visible while the work continues. Move rules to `error` as they come clean — per rule with `commentsConfig({ severity })` and `godFilesConfig({ severity })`, or all at once by switching to `configs.recommended`.

Prefer that over per-file exemption lists. If you do need to exempt files, list the exact paths in a final config block rather than disabling a rule for a directory, and treat the list as one that may only shrink.

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

The defaults are a house rule, not a standard: ESLint's own defaults are 300 and 50, SonarQube ships 750 and 100. Pick numbers your project can hold and tighten them, rather than adopting 500/150 and exempting the files that miss.

## Comment rules

None of these rules has a fixer. `eslint --fix` cannot delete or rewrite a comment, and that is deliberate: whether a comment still earns its place is a judgement about future readers, which no mechanical rewrite can make. A reader who understands the code can — the audit skill applies comment findings directly and reports what it changed, leaving the diff as the review. What the rules ship instead is a remedy in the message — `no-historical-narration` quotes the phrase that matched, so the finding is actionable without reopening the file. See [Directives](#directives).

`commentsConfig` sets all three at once:

```js
import { commentsConfig } from "eslint-plugin-code-quality";

commentsConfig({
  maxRatio: 0.2,
  maxConsecutiveCommentLines: 12,
  severity: "warn",
  narration: { handoffNarration: false, allowPatterns: ["ADR-\\d+"] },
});
```

### `no-historical-narration`

Rejects comments that describe old implementations, migration history, commit history, or redundant cross-references. ESLint control comments, TypeScript suppression comments, and shebangs are ignored.

```js
{
  "code-quality/no-historical-narration": ["error", {
    handoffNarration: true,
    additionalPatterns: [],
    allowPatterns: []
  }]
}
```

| Option | Meaning |
| --- | --- |
| `handoffNarration` | Also reject comments addressed to whoever picks the work up next — `a later agent wires this up`, `Slice 4 owns validation`, `team lead will merge`. Only repositories built by multiple agents or in staged migrations produce these; set `false` if the phrasing means something else in your project. |
| `additionalPatterns` | Case-insensitive source patterns to reject as well, for vocabulary specific to your codebase. |
| `allowPatterns` | Case-insensitive source patterns that exempt a comment, for references a reader genuinely needs — an ADR or RFC number, a ticket id, a spec link. |

The built-in lists are exported as `NARRATION_PATTERNS` and `HANDOFF_PATTERNS` if you want to inspect or extend them.

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

The package installs a `code-quality-gate` bin. It lints the project with its own ESLint configuration and fails only on this plugin's rules **reported as errors**, so warnings and unrelated findings stay visible without gating a build. The blocking set comes from `enabledRuleIds()` rather than a second hand-maintained list, so a rule added to the configs starts gating without touching the gate.

Run `code-quality-gate --help` for the full flag list.

```json
{
  "scripts": {
    "lint:god-files": "code-quality-gate"
  }
}
```

Pass paths to narrow the scope: `code-quality-gate src test`.

### Directory width

The gate also fails when a directory holds more than 10 source files of its own, because a flat folder with fifty modules gives a reader no structure to navigate by. Subdirectories are counted separately — the crowded folder is the finding, and the [split directive](#directives) is printed once beneath the list. Build output, dependencies, and dot directories are skipped.

Ten is deliberately tight: it is the point where a reader stops seeing a folder and starts scanning a list. Raise it with `--max-files-per-dir=` for a project that has not split yet, rather than exempting the folders that miss.

```sh
code-quality-gate --max-files-per-dir=30
code-quality-gate --ignore-dir=generated,__snapshots__
code-quality-gate --ext=.vue,.svelte
code-quality-gate --no-folder-check
```

This is a gate check rather than an ESLint rule on purpose. ESLint sees one file at a time, so a directory-width rule would report the same finding once per file in the folder and would fire on every edit the Claude Code hook lints.

### Inline errors on form controls

The gate also fails when a design-system form control cannot announce its error at the control. A field wrapper that injects `aria-invalid` and `aria-describedby` through `cloneElement` cannot reach a control with a closed prop list, so the helper text renders while no screen reader ties it to the input — a toast or banner is not a substitute. A control passes when it renders its own wired error, or spreads unknown props so the wrapper can reach it.

A bare `<button>` is an action, not a field: only native `input`/`select`/`textarea` and ARIA control roles are judged. Directories are discovered by a `ui/`, `primitives/`, or `forms/` path segment, so `components/ui/forms/`, `primitives/`, and a `packages/ui` in a monorepo all resolve. **Worktrees are never scanned** — neither by the walk nor by an explicit root.

A control that carries no validation waives the check by saying so above itself, with a reason. The reason is required, a bare marker still fails, and every waiver prints on each run:

```tsx
// inline-warning: none — a search box carries no validation state.
export function SearchField({ value, onChange }: SearchFieldProps) {
```

```sh
code-quality-gate --no-inline-warning     # skip it
code-quality-gate --inline-warning-all    # judge feature screens too
```

Importable on its own, like the directory check:

```js
import { findInlineWarningGaps } from "eslint-plugin-code-quality";

findInlineWarningGaps({ roots: ["frontend"] }); // { files, controlCount, waivers, violations }
```

The check is also importable, for a project that wants it somewhere other than the gate:

```js
import { findCrowdedDirectories } from "eslint-plugin-code-quality";

findCrowdedDirectories({ roots: ["src"], max: 25 }); // [{ directory, count }]
```

## Directives

No rule here is autofixable, so the remedy travels in the text. Both reporting surfaces — the gate and the Claude Code hook — close a failing report with the same lines, so an agent that reads one reaches for the same structure as an agent that reads the other:

```
Split by responsibility, never at the line count. Backend: a folder per feature
(routes, service, repository). Frontend: components/, hooks/, lib/. Move whole
exports and re-export them from the original path.

Fix the source, not the check: no eslint-disable, no raised limit, no exemption entry.
```

`max-lines` gets the split directive above, `max-lines-per-function` gets "extract each independently testable step into a named function", and a crowded directory gets the same backend/frontend shape phrased for whole files. Comment findings carry their remedy in the rule message itself and add no extra line. The policy line is printed once per failing run, whatever fired.

The strings are exported, for a project that reports these findings somewhere else:

```js
import { directivesFor, FIX_POLICY, CROWDED_DIRECTORY_DIRECTIVE } from "eslint-plugin-code-quality";

directivesFor(["max-lines", "code-quality/comment-density"]); // one string, deduped
```

The hook ships a verbatim copy because Claude Code installs `claude-plugin/` alone into a versioned cache; `test/plugin-isolation.test.js` pins the two together.

## Claude Code plugin

This package also contains a self-contained Claude Code plugin in `claude-plugin/` and a local marketplace manifest at `.claude-plugin/marketplace.json`.

Add the marketplace and install the plugin from this checkout:

```sh
claude plugin marketplace add .
claude plugin install code-quality@code-quality-local
```

Restart Claude Code after installation. Run `/code-quality:setup-code-quality` in a Node project to install the project's local `eslint` and `eslint-plugin-code-quality` dependencies and append the recommended flat config. Use `/code-quality:audit-code-quality` for a scoped audit. It applies comment findings in the same pass and reports what it removed; structural findings — a file split, a function extraction, a directory reshuffle — are proposed rather than applied, because they move public paths and importers.

### Edit hook behavior

The `PostToolUse` hook runs after `Edit`, `Write`, `MultiEdit`, and `NotebookEdit`. It:

- reads the hook event as JSON from standard input;
- resolves relative paths against `CLAUDE_PROJECT_DIR`, then the event `cwd`;
- ignores unsupported extensions and missing, deleted, directory, symlink, or out-of-project paths;
- finds the workspace that owns the edited file — the nearest ancestor with a flat config, else the nearest `package.json` — so a monorepo package is linted with its own rules rather than the repository root's;
- resolves `eslint` from that workspace without `npx`, downloads, or a shell, which picks up either a package-level install or one hoisted to the root;
- exits `0` in silence when the project has no ESLint of its own, so the hook stays invisible in projects that have not opted in;
- runs ESLint only on the changed file with the consumer's existing configuration and cache disabled;
- reports errors only — a rule the project set to `warn` never blocks an edit;
- closes a failing report with the [directives](#directives) for the rules that fired, derived from every error rather than only the ten shown;
- exits `0` when clean or non-applicable and `2` with concise diagnostics for lint, configuration, or parser failures.

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
