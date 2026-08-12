# Changelog

All notable changes to this package are documented here.

## 0.6.0 - 2026-08-12

### Changed

- One `configure()` call replaces `commentsConfig`, `godFilesConfig`, `wrappersConfig`, `designTokensConfig`, `configs.comments`, `configs.godFiles`, `configs.wrappers`, `configs.designTokens`, `configs.adopting`, and `enabledRuleIds`. It takes one severity per rule — `"error"`, `"warn"`, `"off"`, or `[severity, options]`, where options merge over the defaults so a raised cap never drops `skipComments` — plus `tokens`, `testGlobs` and `ignores`. A misspelled rule name throws rather than leaving that rule quietly at `error`. `configs.recommended` is `configure()`. `configs.adopting` is gone rather than fixed: it silently omitted `no-pass-through-wrapper`, so every project that adopted through it had never run that rule.
- `RULE_IDS` replaces `enabledRuleIds()` as what the gate blocks on — every rule this plugin owns, whether or not a given config turns it on. `RULE_NAMES`, `SETTINGS_FILE`, `TOKEN_SECTIONS` and `ESLINT_CONFIG_FILES` are exported beside it, so the gate, the setup CLI and the isolation test name each of those things once.
- The edit hook uses prettier's Node API rather than spawning its CLI: it runs after every edit, and a second Node start would cost more than the whole check. The settings read sits behind the extension test, which rejects a `.md` edit with no I/O at all, and the opt-out is read from the workspace owning the edited file as well as the repository root, so one package of a monorepo can opt out.

### Added

- `no-raw-colors`: hex literals, colour functions (`rgb()` through `oklch()` and `color()`), and named CSS colours are rejected in class strings, inline `style={{}}` objects, Tailwind arbitrary values, template literals, and every other string. `var()` passes, including as the channels of a colour function — `rgb(var(--brand-rgb) / .5)` is a token at an opacity, not a literal — and `transparent` and `currentColor` stay legal. A colour name only counts beside a declaration that takes one or inside a `-[…]` value. A `#` is only a colour where one can go: a URL fragment, a `url()`, a DOM query, and an `href`/`id`/`htmlFor`/`to` attribute name a document, so an id spelled in hex letters is not a finding. Options: `tokenSource`, `exemptFiles`, `colorProperties`, `namedColors`, and an `allow` list of one literal, optionally in one file, with a required reason.
- `no-arbitrary-sizes`: font size, radius, line height, and height are rejected anywhere; padding only inside an interactive element, read off the enclosing JSX opening element — tag name, `onClick`, `role`, or `cursor-pointer`. A value naming `var()` or `calc()` can never match, and width is deliberately unchecked. A family may also name the declarations it covers, and font size does, so `style={{ fontSize: 13 }}` and `<text fontSize="11" />` are caught from the tree — a size written as a declaration passes through no class string. Options: `everywhere`, `onInteractive`, `interactive`, `units`, `allow`, `exemptFiles`, and `tokenSource`.
- `findArbitrarySizesInFiles()`, the size ban over stylesheets, for families naming a CSS `properties` list: `font-size: 14px` outside the ramp, with `var()`, `calc()`, and keywords passing.
- `findRampGaps()`: ramp steps declared without a companion token. Tailwind resolves `--text-lg--line-height` off the step's own name, so a step declared without one inherits whatever the cascade last set — a different rhythm per surface, from a token file that looks complete. `prefix` and `requires` are the project's to name; `TYPE_RAMP_DIRECTIVE` is the remedy.
- `configure({ tokens })` names the token file once for both design rules and exempts it from them. Exemptions a rule is given of its own are added to that, not swapped for it. Both rules stay `off` until `tokens` names a layer: they mean nothing without one, and in a project without one every `#fff` would report.
- `findRawColorsInFiles()`, the same colour ban as a text scan over `.css`, `.scss`, `.sass`, and `.less`. ESLint parses no CSS without a language plugin, so the rules cover JS and TypeScript only and the stylesheet half is a function rather than a silent gap.
- `findContrastFailures()`: WCAG 2.1 ratios over the tokens parsed out of a CSS file, for declared pairs and for pairs scanned out of markup. One of `tokenFile` or `sources` is required, with no default. `sources` reads a theme spread over several files or blocks — a semantic layer over a raw palette, which is what Tailwind v4's `@theme inline` is for — and `var()` aliases are followed to the value they end at, so a two-layer theme measures the same as a one-layer one. `resolveTokenAliases()` and `readTokenSources()` are exported. A standing failure is waived with a required reason; an unknown token, a non-hex value, and a translucent one are reported as unresolvable, never skipped and never scored opaque. This is a function and not a rule because contrast needs the token file and every screen at once, which a per-file rule cannot see.
- `code-quality.json`, one settings file the gate reads from the run directory, holding every flag it used to take plus the four checks ESLint cannot answer — `stylesheets`, `sizes`, `typeRamp`, `contrast`. Its own paths resolve against its own directory; a section naming no `roots` sweeps the paths the gate was given, which stay relative to where the gate ran. A configured project runs `code-quality-gate` with no flags at all. `--config=FILE` names it elsewhere, `--no-config` ignores it, and every flag still overrides its key for one run.
- `"allRules": true` widens the gate from this plugin's rules to every rule the project sets to `error`, for a repository that wants one gating command rather than a gate beside a second `eslint` run. Off by default: the filter is what keeps an unrelated rule out of a build that gates on this plugin.
- `"hook": false` opts one project out of the edit hook, which is enabled once for every project the user opens.
- The edit hook runs the file through the project's own `prettier` before the rules, so they judge the file a reviewer will read and a formatting nit is never one of the errors blocking an edit. Only where prettier is already a dependency: choosing a formatter is not this plugin's call. The project's own prettier config and `.prettierignore` decide, and a prettier that fails is left to ESLint, which reports the same broken syntax with a location.
- `code-quality-setup`, which does every mechanical step of adopting the plugin in one project: the package manager off the lockfile, `eslint` and a parser, this checkout linked (`link:` for pnpm, which has no global link and copies a `file:` into its store), `eslint.config.mjs`, `code-quality.json`, a `lint:code-quality` script, and a gate run whose counts are the report. Severities are arguments because they are the only part nobody can infer from the code. A second run rewrites the `configure()` call it wrote and nothing else around it; a config assembling the plugin some other way is reported rather than guessed at. `--dry-run` prints every file and command and writes none.
- Exported vocabulary and helpers: `NAMED_COLORS`, `NEUTRAL_COLOR_KEYWORDS`, `COLOR_PROPERTIES`, `DEFAULT_SIZE_FAMILIES`, `DEFAULT_INTERACTIVE_SIZE_FAMILIES`, `DEFAULT_INTERACTIVE`, `DEFAULT_SIZE_UNITS`, `DEFAULT_CONTRAST_THRESHOLDS`, `DEFAULT_STYLESHEET_EXTENSIONS`, `DEFAULT_MARKUP_EXTENSIONS`, `findRawColors()`, `readColorTokens()`, and `contrastRatio()`.

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

- `/code-quality:setup-code-quality` points every project at one shared checkout — `npm link` for npm and yarn, a declared `link:` dependency for pnpm, which has had no global link since pnpm 11 — and forbids vendoring a copy into the repo, which goes stale silently while its version number still matches. It also covers the two installs that used to strand it: this package is unpublished, so a registry 404 means "depend on the local checkout" rather than "wrong name", and pnpm needs `link:` because it copies a `file:` dependency into its store. It also picks the parser from the project's TypeScript version — `@babel/eslint-parser` when TypeScript is outside `@typescript-eslint/parser`'s supported range, with JSX enabled for `.tsx` alone so a `.ts` generic is not read as an unclosed element.
- `/code-quality:audit-code-quality` runs the gate once from the repository root, and reads a registry 404 as standing in the wrong directory rather than a missing install.
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
