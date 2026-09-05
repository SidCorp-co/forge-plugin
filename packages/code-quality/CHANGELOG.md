# Changelog

All notable changes to this package are documented here.

## 0.14.0 - 2026-09-05

### Fixed

- The edit hook's "ESLint is configured here but not installed" stamp is reaped. It was a zero-byte `code-quality-said-<key>` per (session, workspace) written flat into the system temp root, and nothing had ever removed one: 553 of them on one machine and 216 on another, both counted the same day. The stamps now live in a single `code-quality-said-<uid>` directory the script makes on first write, and every write first reads that directory and unlinks the entries older than a day — a session's memory, and no session outlives one. The sweep reads only its own directory, so a temp root full of other people's files is neither scanned nor touched, and the ones the old naming already left behind stay where they are. The directory carries the user id because a shared name belongs to whoever creates it first, and the second user's failed `mkdir` would have turned "said once per session" into said on every edit.

## 0.13.0 - 2026-08-31

### Fixed

- `no-raw-elements` reported nothing where a configured primitive is absent from the barrel it names. Skipping is right for the default map — a project may simply have no `Select`, and there is nothing to compose — but a `primitives` entry the project wrote is its own claim about its own barrel, and when the barrel stops exporting the name the rule retires for that element with nothing said. `sid-growth` carries 202 lines written around exactly this. A configured entry now reports `missingPrimitive`, after the exemptions, so a `type="hidden"` input or a waived site still passes.
- `meta.version` had drifted to `0.11.0` again, two releases behind the package. A test now compares the two, since ESLint prints it in `--print-config` and nothing else fails on a stale one.

### Changed

- One directory traversal, `walkDirectories()`, behind the crowding count, the design scans and the gate's own workspace discovery: written out per call site, the ignore list lived in three places and agreed in none. `SOURCE_EXTENSIONS` and `DEFAULT_MARKUP_EXTENSIONS` move beside it — what a sweep keeps belongs with what it skips — and the markup list now derives from the source list rather than restating it two entries short.
- One file-scan shell, `readSourceFiles()`, behind the four scanners that read every file, and one `ALLOW_ENTRY_SCHEMA` and `ALLOWLIST_OPTIONS` behind the two allowlisted design rules, which each carried a byte-identical copy. A field added to one copy is a schema the other rejects.
- `CSS_WIDE_KEYWORDS` is the one list of the four keywords every property accepts; `NEUTRAL_COLOR_KEYWORDS` and `DEFAULT_VALUE_KEYWORDS` spread it instead of spelling it out.
- Findings state the number to act on rather than the ratio it came from: `comment-density` says how many lines to delete, `max-consecutive-comment-lines` how many over the run is. The unguessable half of a remedy moves out of the per-occurrence message into `RULE_DIRECTIVES`, which a report prints once — the message is 130 characters where it was 204, and `no-duplicate-comment`'s is 69 where it was 260.

## 0.12.0 - 2026-08-31

### Added

- `restated: deliberate — <reason>`, `no-duplicate-comment`'s own waiver, joining `pass-through: keep` and `primitive: none` in `line-metrics.js`. A comment written to contrast with an earlier one borrows its vocabulary wholesale, so it measures as a restatement and no threshold tells the two apart. Measured rather than assumed: over `sid-growth`, `sonahome` and `search-master` — 3,072 files, 53 reports, every one classified by hand — 47 were true, 3 arguable and 3 false, and all 3 false were that same shape. A variant that dropped a pair whose shared words flip negation removed 2 of the 3 but took 5 true findings with them, which is why the rule does not guess: the author states it. The waiver reaches the block beneath it rather than only itself, because a directive ends the run of `//` lines it sits in, and the reason stays mandatory.

## 0.11.0 - 2026-08-30

### Added

- `no-duplicate-comment`: a comment restating what an earlier comment in the same file already says. The other two comment rules are structurally blind to it — density counts lines without reading them, narration matches phrases inside one comment at a time — so a constraint written down twice passed every gate. Two copies of one rule read as correct on their own, which is exactly why it needs measuring rather than reviewing: the pair diverges the first time someone corrects only the copy they found, and nothing reports the divergence. The measurement is lexical, a Jaccard index over content words with a floor on how many words two sentences must actually share, so it is a floor on quality and never a proof of absence. A run of `//` lines is treated as one comment, because a sentence routinely spans two of them, and a comment written to satisfy a checker is skipped rather than counted: `no-pass-through-wrapper` demands a waiver at every wrapper it allows, so every waiver in a file says the same thing by construction and reporting them would set the two rules against each other. The waiver vocabulary now has one home in `line-metrics.js` — `waiverPattern()`, `PASS_THROUGH_WAIVER`, `RAW_ELEMENT_WAIVER` and `isWaiver()` — which is where `no-pass-through-wrapper` and `no-raw-elements` read their own, so a change to the syntax reaches every side at once.
- `findOverlaps()`, `findOverlapsAgainst()`, `splitSentences()`, `contentWords()`, `overlap()` and `STOP_WORDS` are exported: the same measurement a whole-tree duplicate check needs, since ESLint is only ever handed one file and cannot see a statement repeated across a module and its caller.

## 0.10.0 - 2026-08-15

### Added

- `findUnknownTokens()`: a utility naming a theme variable no palette declares. `border-warn` where the token is `--color-warning` is not an error to Tailwind — it emits no rule at all, so the element renders unstyled, the tests pass and the reviewer sees a plausible class name. Two screens shipped `border-warn bg-warn-soft` for months on exactly that. The severity is no longer cosmetic either: with class strings merged through `tailwind-merge`, a class whose token is missing is not inert, it displaces the working utility that precedes it in the same call. The check reads the same inventory the contrast rule does, per theme, so a name only the dark block declares is reported as absent from the light one; a `dark:` utility is asked only of the theme it names.
- The same call reports a bare `var()` on a property that takes either a length or a colour. Tailwind reads `border-[var(--tab-indicator-height)]` as `border-color: 2px`, which the browser drops: the underline tab had no indicator and the checkbox had no border, in production, with no error anywhere. The token's own value settles it, so `border-[var(--color-x)]` is never reported and `border-[length:var(--x)]` is the remedy the finding names.
- `stringLiterals()` is exported: the quoted-run reader the markup scans share.
- `unknownTokens` is a settings section, so the gate runs the check from the config the project already keeps. Naming Tailwind's own `theme.css` among the `sources` is how a project keeps its built-in palette resolvable; omitting it is how a project bans everything it did not declare.

### Fixed

- `meta.version` had been left at `0.7.0` for two releases.

## 0.9.0 - 2026-08-15

### Added

- `findRedundantOverrides()`: a declaration in a theme's own block whose value is already in force under it. The contrast check pairs tokens, so it can only see a colour someone stated twice in one class string; it is structurally blind to the token nobody rebound at all, which is the more common dark-theme defect and needs no pairing to detect. A block that restates the base value changes nothing and reads exactly like a rebinding that was considered, which is what hides the one that was never made — the token is then silently the base theme's colour on a surface the base theme never had. Values are compared after `var()` is followed, so an alias landing on the same colour is the same no-op as a repeated literal. The gate runs it off `contrast.themes`, because the layering is a fact the project has already declared once and a second copy is two declarations that must agree.
- `themePalettes()` is exported: the theme-to-layers reading both checks share.

## 0.8.0 - 2026-08-13

### Fixed

- A `block` is matched by the header that opens it, not by `indexOf`. `.dark` occurs in a comment and inside `@custom-variant dark (&:where(.dark, .dark *))` above the block it names, so a substring search reached the `@theme` block instead and every reader of the result — the contrast gate, the type ramp — measured the light theme while reporting on the dark one. A checker that silently measures the wrong thing and prints green is the worst failure mode a checker has. A block the file does not declare now throws naming the file, rather than falling through to whichever block matched, and a declaration inside a comment is no longer read as a declaration.

### Added

- `themes` on `findContrastFailures()`: one run measures every theme a file declares and each finding names the theme it came from. A theme is `{ name, blocks }` layered innermost first, because a second theme is usually a partial rebinding — a `.dark` block restates the colours that move and inherits the rest from `@theme`, so measuring the block alone measures half a palette. One `allow` list covers every theme: a waiver is a decision about a pair, and a second config with a second list is two lists that must agree. The markup scan runs once for all of them, so a second theme costs no second sweep of the project. Without `themes` the call measures one unnamed palette exactly as before.
- The gate prints the themes it measured beside the file counts, and prefixes each contrast finding with `[theme]`. With `dark:` utilities banned by convention a dark theme is entirely token rebinding, so a regression there is invisible in the source and a report that does not say which theme failed is unactionable.
- `findContrastFailures()` returns `{ themes, pairs, failures, waivers }`; the palette that was `tokens` is `themes[0].tokens`, and each entry of `themes` carries its own `failures` and `waivers`. Its header states what a clean run does not cover: a colour that only exists at runtime, a pair nothing declares, and any theme missing from the list.

## 0.7.0 - 2026-08-12

### Added

- `no-raw-elements`: a raw element the design system already owns a primitive for is a finding, and the report names the primitive and the behaviour the element drops. A `<select>` beside a `Select` gets the browser's metrics and the OS chevron — which is what a styled label above an unstyled control is — and a raw `<button>` gets neither the focus ring nor the disabled semantics. The default map is the form controls and the headings (`DEFAULT_PRIMITIVES`), and the map is the mechanism: an element absent from it is never judged, so `table` → `DataTable` is a map entry rather than a new rule.
- Three things `no-raw-elements` does not report, so it can run over a repository rather than one directory: the primitive's own definition, meaning the file that *exports* it — `forms/input.tsx` exporting `Input`, `Select` and `Textarea` may render all three; `<input type="hidden">` and `type="file"`, neither of which is a control a primitive can own; and a heading carrying one of the project's `rampClasses`, because a section that owns its own `aria-labelledby` heading is not a card and the ramp step was the thing the primitive supplied. A class that is not a ramp step does not open that escape.
- Inside the design system (`DESIGN_SYSTEM` directory names, or anything under `source`) the report inverts: a file rendering `<button>` without exporting `Button` is asked to add the variant to `Button` and compose it, not to import it. That is where the drift starts — a segmented control, a menu row and an icon button each hand-rolling a focus ring is three rings to keep in step, and the primitive's "the ONLY `<button>`" comment stops being true inside its own directory. A control the primitive cannot become (`role="radio"`, `role="menuitem"`) takes the waiver, whose reason records which control it is. `systemVariants: false` skips the system wholesale, for a project adopting the rule over its screens first. The definition check reads the linted file's own text, so no file is read twice and an unsaved edit is judged as written.
- `source` narrows `no-raw-elements` to the primitives the design system actually exports, read off its barrel once and cached (`primitiveExports()`): a project whose system has no `Textarea` has nothing to point a report at, so the element written instead is not yet a finding. An unreadable source reports every element rather than passing them silently.
- A control no primitive models — a whole row that is one button, a tile carrying `aria-pressed` — is waived at the site with `primitive: none — <reason>`, the shape `inline-warning: none —` already uses. The reason is mandatory, and one waiver covers the next raw element only, so a second one below it still reports.
- `no-raw-elements` is off over `testGlobs`, in the same block that relaxes the per-function cap there: a raw control in a test is a stub standing in for a screen, which no primitive's focus ring was ever going to reach. A star barrel (`export * from "./controls/button"`) is followed to the modules it re-exports, since a system whose barrel names nothing itself would otherwise read as exporting nothing and pass every raw element in silence.
- `configure({ primitives })` names the design system once, the way `tokens` names the token layer, and turns `no-raw-elements` on. It stays `off` until then: with no system to point at, every `<button>` in the project reports and no message can say what to write instead. `code-quality-setup --primitives=DIR` writes that section.

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
