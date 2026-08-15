# eslint-plugin-code-quality

ESLint rules and flat configs for three related limits: comments that record current constraints rather than implementation history, files and functions that stay small enough to read, test, and move, and colour and size values that reach the screen through design tokens instead of literals.

## Requirements

- Node.js 20 or newer
- ESLint 9 or 10

## Install

`code-quality-setup` does the whole adoption in one command — the dependency off the lockfile's
package manager, the flat config, the settings file, the lint script, and a gate run to report what
it found:

```sh
npx code-quality-setup --comment-density=warn --max-lines=error --tokens=app/globals.css
npx code-quality-setup --help      # every rule takes error, warn or off
npx code-quality-setup --dry-run   # print all of it, write nothing
```

A severity per rule is the only thing it asks for, because it is the only part that cannot be read
off the project. A second run rewrites the `configure()` call it wrote and leaves the rest of the
file alone; a config assembling this plugin some other way is reported rather than guessed at.

By hand, from a local checkout:

```sh
npm install --save-dev eslint file:/absolute/path/to/eslint-plugin-code-quality
```

After the package is published, replace the `file:` dependency with `eslint-plugin-code-quality`.

## Flat config

One call, one severity per rule. Anything you do not name is `error`.

```js
import { configure } from "eslint-plugin-code-quality";

export default configure();
```

```js
export default [
  { files: ["**/*.{ts,tsx}"], languageOptions: { parser: tsParser } },
  ...configure({
    "comment-density": ["warn", { maxRatio: 0.2, minCommentLines: 6 }],
    "no-pass-through-wrapper": "off",
    "max-lines": ["error", { max: 300 }],
    tokens: { tokenSource: "app/globals.css" },
  }),
];
```

`configure` returns an array, so spread it into a config that has other entries. Each rule takes
`"error"`, `"warn"`, `"off"`, or `[severity, options]` — options merge over the defaults, so raising
a cap never silently drops `skipComments`. A misspelled rule name throws rather than leaving that
rule quietly at `error`.

| Key | Effect |
| --- | --- |
| any of the eight rule names | its severity, optionally with its options |
| `tokens` | `{ tokenSource, exemptFiles }` — turns the two design rules on and exempts the token file from both |
| `testGlobs` | globs the per-function cap is off in; `[]` to keep it everywhere |
| `ignores` | a leading ignores entry, for convenience |

`configs.recommended` is `configure()` for a project that wants no opinions. Nothing in it assumes a
framework, a directory layout, or TypeScript; bring your own parser and put it first. The
[design-token rules](#design-token-rules) are the exception — they read utility class strings and JSX
elements — and stay off until `tokens` names a layer, because without one every `#fff` reports.

## Adopting in an existing project

A codebase that has never run these checks will light up on the first run, so start the noisy rules
at `warn`:

```js
export default configure({ "comment-density": "warn", "max-lines": "warn" });
```

Warnings fail neither `code-quality-gate` nor the Claude Code edit hook, so the findings stay visible
while the work continues. Move each to `error` as it comes clean.

Prefer that over per-file exemption lists. If you do need to exempt files, list the exact paths in a
final config block rather than disabling a rule for a directory, and treat the list as one that may
only shrink.

## God-file limits

```js
{
  "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }]
}
```

These are ESLint's own rules with tuned options, not reimplementations. Comments and blank lines are excluded, so the limits measure implementation breadth and a file is never penalised for explaining itself. Test files keep the file limit but not the per-function limit, because a `describe` callback is a single function to ESLint and capping it would reward fewer, larger test cases.

Both are tunable through `configure`, and tuning one option keeps the rest:

```js
configure({
  "max-lines": ["warn", { max: 300 }],
  "max-lines-per-function": ["warn", { max: 80 }],
  testGlobs: [],
});
```

The defaults are a house rule, not a standard: ESLint's own defaults are 300 and 50, SonarQube ships 750 and 100. Pick numbers your project can hold and tighten them, rather than adopting 500/150 and exempting the files that miss.

## Comment rules

None of these rules has a fixer. `eslint --fix` cannot delete or rewrite a comment, and that is deliberate: whether a comment still earns its place is a judgement about future readers, which no mechanical rewrite can make. A reader who understands the code can — the audit skill applies comment findings directly and reports what it changed, leaving the diff as the review. What the rules ship instead is a remedy in the message — `no-historical-narration` quotes the phrase that matched, so the finding is actionable without reopening the file. See [Directives](#directives).

```js
configure({
  "comment-density": ["warn", { maxRatio: 0.2 }],
  "max-consecutive-comment-lines": ["warn", { max: 12 }],
  "no-historical-narration": ["warn", { handoffNarration: false, allowPatterns: ["ADR-\\d+"] }],
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

## Design-token rules

A colour or a size that reaches the screen as a literal is outside the token layer: it cannot be re-themed, and no contrast check can see it. These two rules keep both inside the tokens.

They stay **off** until `tokens` names a layer. They only mean something in a project that publishes
design tokens, and in one that does not, every `#fff` in a string would report. Name the token file
and every report says where the value belongs; the token file exempts itself:

```js
export default configure({ tokens: { tokenSource: "app/globals.css" } });
```

Per-rule options are added beside it, and exemptions of their own are added to the token file's
rather than replacing it:

```js
configure({
  tokens: { tokenSource: "app/globals.css", exemptFiles: ["src/theme.ts"] },
  "no-arbitrary-sizes": ["warn", { units: ["px"], exemptFiles: ["src/vendor/**"] }],
});
```

| Option | Meaning |
| --- | --- |
| `tokenSource` | The token file, named in every remedy. It is added to `exemptFiles`, because the one file allowed to hold literals is the one that declares them. |
| `exemptFiles` | Extra paths, matched by tail (`app/globals.css` finds it at any depth) or as a glob (`src/legacy/**`). Exemptions passed under `colors` or `sizes` are added to these, not swapped for them. |
| `colors`, `sizes` | Passed through to `no-raw-colors` and `no-arbitrary-sizes`. |
| `severity` | `error` by default. |

### `no-raw-colors`

Rejects hex literals, colour functions (`rgb()`, `rgba()`, `hsl()`, `hsla()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`), and named CSS colours, in class strings, inline `style={{}}` objects, Tailwind arbitrary values (`text-[#fff]`, `bg-[rgb(0,0,0)]`), template literals, and any other string the file holds.

A `var()` reference is the sanctioned way to reach a colour and always passes — including through a colour function, which is how a token carries an opacity: `rgb(var(--color-brand-rgb) / 0.5)` and `hsl(var(--h) var(--s) var(--l))` are tokens, not literals. Alpha may be a number there, since an opacity is not a colour; a literal in a *channel* still reports. `transparent`, `currentColor`, and the CSS-wide keywords carry no colour of their own and stay legal. A colour **name** only counts beside a declaration that takes one (`color: red`, `fill="rebeccapurple"`) or inside a Tailwind arbitrary value (`text-[hotpink]`) — a bare `navy` is a token name or a class fragment.

A `#` is only read as a colour where one can go. A fragment after a path or a word (`/docs#abcdef`), a `url(#gradient)`, a DOM query (`querySelector("#face")`), and an `href`/`id`/`htmlFor`/`to` attribute name a document, so an id spelled in hex letters is not a finding.

```js
{
  "code-quality/no-raw-colors": ["error", {
    tokenSource: "app/globals.css",
    exemptFiles: ["app/globals.css"],
    colorProperties: [],
    namedColors: [],
    allow: [{ file: "src/mask.tsx", value: "#000000", why: "an SVG mask stop, not a surface" }]
  }]
}
```

| Option | Meaning |
| --- | --- |
| `tokenSource` | Named in the remedy: *add the colour to `app/globals.css`*. |
| `exemptFiles` | Paths the rule skips entirely, the token file first among them. |
| `colorProperties` | Declarations and JSX attributes whose value is a colour. Defaults to the CSS colour properties in both `camelCase` and `kebab-case`; exported as `COLOR_PROPERTIES`. |
| `namedColors` | The colour-name list, exported as `NAMED_COLORS` (148 names, minus the keywords in `NEUTRAL_COLOR_KEYWORDS`). Replace it for a project with its own palette words. |
| `allow` | One literal, optionally in one file, and **why no token fits**. The reason is required by the schema. |

### `no-arbitrary-sizes`

Rejects Tailwind arbitrary values that duplicate a ramp step: font size, radius, and line height anywhere, height anywhere, and padding **only inside an interactive element**, where control tokens have an answer. Width is deliberately unchecked — a table's min-width and a drawer's column are layout decisions no token layer has an opinion on.

Anything reaching a token passes by construction: `h-[var(--control-height-lg)]` and `text-[calc(var(--avatar-size)*0.45)]` never match, because a family only matches a bracketed bare number.

A family may also name the CSS declarations it covers, and font size does: `properties: ["fontSize", "font-size"]`. A size written as a declaration never passes through a class string, so `style={{ fontSize: 13 }}`, `{ "font-size": "0.875rem" }`, and `<text fontSize="11" />` are read from the tree instead. `var()`, `calc()`, and keywords like `inherit` pass here too. The other families carry no `properties`: `height: 720` in a style object is layout, the same as `w-[240px]`.

Interactivity is read off the enclosing JSX opening element — its tag name, an `onClick`, a `role`, or a `cursor-pointer` class — so `<button className="px-[7px]">` reports and `<div className="p-[3px]">` does not.

```js
{
  "code-quality/no-arbitrary-sizes": ["error", {
    tokenSource: "app/globals.css",
    everywhere: [{ name: "font size", prefixes: ["text"], hint: "Use a step from the type ramp." }],
    onInteractive: [{ name: "padding", prefixes: ["p", "px", "py"], hint: "Use a control padding token." }],
    interactive: { elements: ["Chip"], roles: [], attributes: [], classNames: [] },
    units: ["px", "rem", "em", "%"],
    allow: [{ file: "src/mobile/phone-frame.tsx", value: "h-[720px]", why: "illustration: drawn geometry, not a sized box" }]
  }]
}
```

| Option | Meaning |
| --- | --- |
| `everywhere` | Families checked on any element. Each is `{ name, prefixes, properties, hint }`; `name` appears in the report and `hint` is the remedy. Defaults are exported as `DEFAULT_SIZE_FAMILIES`. Prefixes match exactly, so `rounded-tl` is its own entry. |
| `onInteractive` | Families checked only inside an interactive element. Default: padding (`DEFAULT_INTERACTIVE_SIZE_FAMILIES`). Pass `[]` to switch it off. |
| `interactive` | What counts as interactive: `elements`, `roles`, `attributes`, `classNames`. Each key replaces its default (`DEFAULT_INTERACTIVE`). |
| `units` | Units a bracketed number may carry (`DEFAULT_SIZE_UNITS`). |
| `allow` | One literal, optionally in one file, and why no token fits. Written as the value alone — `red`, `rgba(0,0,0,.2)`, `h-[720px]` — and compared without regard to spacing. |
| `exemptFiles` | As above. |

### What ESLint cannot see

Several parts of this ban do not fit a per-file, AST-based rule, and are shipped as functions instead of pretending otherwise:

- **Stylesheets.** ESLint parses no `.css` without a CSS language plugin, and this package ships none. The rules above cover `.js`/`.jsx`/`.ts`/`.tsx` — including CSS-in-JS template literals — and **not** your stylesheets. `findRawColorsInFiles()` and `findArbitrarySizesInFiles()` are the same two bans as a text scan over `.css`, `.scss`, `.sass`, and `.less`.
- **Ramp completeness.** Whether a type ramp declares a line height beside every size is a fact about one file read whole, not about any file being linted. `findRampGaps()` answers it.
- **Contrast.** A WCAG check needs the token file and every screen that pairs two tokens at once. A per-file rule would have to re-read the token file and would still report one pair once per file that mentions it. `findContrastFailures()` takes the whole project.
- **Utilities naming a token that does not exist.** Whether `border-warn` resolves is a question about the token file, not about the file being linted, and the answer differs per theme. `findUnknownTokens()` takes both.

```js
import { findContrastFailures, findRawColorsInFiles } from "eslint-plugin-code-quality";

findRawColorsInFiles({ roots: ["app"], exemptFiles: ["app/globals.css"] });
// [{ file, line, kind, value }]

findArbitrarySizesInFiles({ roots: ["app"], exemptFiles: ["app/globals.css"] });
// [{ file, line, family, value, hint }] — `font-size: 14px` outside the ramp

findRampGaps({ tokenFile: "app/globals.css", block: "@theme" });
// [{ token: "--text-lg", missing: "--text-lg--line-height" }]

findContrastFailures({
  tokenFile: "app/globals.css",   // required, no default
  block: "@theme",                // one theme out of a file that declares several
  roots: ["app", "components"],
  declaredPairs: [
    { fg: "--color-fg-muted", bg: "--color-bg-1", why: "row labels on a card" },
    { fg: "--color-primary", bg: "--color-bg-1", need: "nonText", why: "focus ring against a card" }
  ],
  allow: [{ fg: "--color-border", bg: "--color-bg-1", why: "design: raising it re-draws every border" }]
});
// { themes, pairs, failures, waivers }
```

A file that declares more than one theme is **one** run, not one per theme. `themes` names each and lists the blocks it is layered from, innermost first, because a second theme is usually a partial rebinding — a dark block restates the colours that move and inherits the rest:

```js
findContrastFailures({
  tokenFile: "app/globals.css",
  themes: [
    { name: "light", blocks: ["@theme"] },
    { name: "dark", blocks: ["@theme", ".dark"] }   // 42 rebound, 14 inherited
  ]
});
// failures: [{ theme: "dark", fg, bg, ratio, reason, … }]
```

Every finding names the theme it came from, and `themes` on the result carries each palette with its own `failures` and `waivers`. One `allow` list covers them all: a waiver is a decision about a pair, not about a theme, and duplicating it per theme is two lists that must agree. This matters most where a theme is *only* token rebinding — with `dark:` utilities banned by convention, a dark-only contrast regression appears nowhere in the source and can be caught only by measuring the block. A theme the list omits is a theme nothing measures.

`findRedundantOverrides()` reads the same `themes` and reports the other half of that blind spot: a declaration in a theme's own block whose value is already in force underneath it. Such a line changes no colour, and in the block it is indistinguishable from the rebinding nobody made — which is how a token stays the base theme's colour on a surface the base theme never had, in a file that appears to name it. Values are compared after `var()` is followed, so an alias landing on the same colour is the same no-op as a repeated literal. It needs no pairing and no markup: a token restated is measurable on its own.

```js
findRedundantOverrides({ tokenFile: "app/globals.css", themes });
// [{ theme: "dark", token: "--color-primary-deep", value: "#a34715", block: ".dark" }]
```

A theme spread over more than one file or block — a semantic layer over a raw palette, which is what Tailwind v4's `@theme inline` is for — is passed as `sources` instead of `tokenFile`, innermost layer first:

```js
findContrastFailures({
  sources: [
    { file: "app/tokens.css", block: ":root" },        // --ink-900: #181b22
    { file: "app/globals.css", block: "@theme inline" } // --color-fg: var(--fg-default)
  ]
});
```

A `block` is matched by the header that opens it — the selector or at-rule immediately before a `{`, with comments ignored — and never as a substring. `.dark` typically occurs in a comment and inside `@custom-variant dark (&:where(.dark, .dark *))` above the block it names, and a substring search would select whichever block came next and report a green run over a theme nobody asked for. A block the file does not declare throws rather than falling through to one it does.

`var()` aliases are followed to the value they end at, across sources and any number of hops, so a two-layer theme measures the same as a one-layer one. A cycle or a name nothing declares resolves to itself and is reported as unresolvable. The plugin has no opinion on how many layers a theme has: its ban is on literals *outside* the token layer, and both shapes keep them inside.

One of `tokenFile` or `sources` is required, with no default: every project names its token file differently, and a guess would report a clean run over tokens that were never read. An `allow` entry moves a failure into `waivers` and must say why it stands — the finding then carries both the site it renders at (`why`) and the decision that lets it through (`waivedBecause`). Thresholds default to WCAG 2.1 — 4.5 for text, 3 for large text, 3 for non-text boundaries and focus indicators (`DEFAULT_CONTRAST_THRESHOLDS`) — and `need` on a pair is a threshold name or a ratio.

Pairs come from two places: the `declaredPairs` a project states, and the markup scan, which pairs a background utility with a foreground utility in the same class string and maps them onto tokens by `tokenPrefix` (default `--color-`). A utility carrying an opacity or an arbitrary value is skipped, because what it composites against is not in the token table. The scan runs once for all themes: a class string pairs the same two tokens whichever theme binds them, and a name only one theme declares is a rebinding gap the others report rather than a pair to drop. A token whose value is not a hex colour is reported as unresolvable rather than skipped. So is a translucent one (`#1118270a`): what it composites over is a fact about a screen, and scoring it opaque would pass a pair that fails in the browser.

### Utilities naming a token that does not exist

`border-warn` where the token is `--color-warning` is not an error to Tailwind. It emits no rule at all: the element renders unstyled, every test passes, and the reviewer sees a plausible class name. Two screens shipped `border-warn bg-warn-soft` for months on exactly that. Merging class strings through `tailwind-merge` raises it from cosmetic to destructive — a class whose token is missing is no longer inert, it displaces the working utility before it in the same call.

```js
findUnknownTokens({
  tokenFile: "app/globals.css",
  themes: [
    { name: "light", blocks: ["@theme"] },
    { name: "dark", blocks: ["@theme", ".dark"] }
  ],
  roots: ["app", "components"]
});
// [{ file, line, kind: "unknown token", candidate: "border-warn",
//    token: "--color-warn", missing: ["light", "dark"] }]
```

A utility is read as a prefix and a value, and the value has to resolve in the namespaces that prefix takes: `text-sm` is a ramp step, `text-danger` is a colour, and either resolving is enough. Variants are stripped first, and a variant that names a theme narrows the question to it — `dark:bg-surface` is only ever read under the dark palette. What never reports: a number (`border-2`), an opacity (`bg-navy/45`), one of Tailwind's own static values (`bg-clip-text`, `outline-offset-2`), an arbitrary value, or a name any palette declares.

| Option | Meaning |
| --- | --- |
| `tokenFile`, `block`, `sources`, `themes` | The palettes, read exactly as the contrast check reads them. One of `tokenFile` or `sources` is required. |
| `roots`, `extensions`, `exemptFiles` | The markup to scan. |
| `namespaces` | Utility prefix → the theme namespaces its value may come from (`DEFAULT_TOKEN_NAMESPACES`). A project that adds a namespace to its theme adds it here. |
| `keywords`, `values` | Values a namespace takes without a theme variable — Tailwind 4.3's own static utilities (`DEFAULT_UTILITY_KEYWORDS`) and the CSS-wide keywords (`DEFAULT_VALUE_KEYWORDS`). |
| `ambiguous` | Prefixes whose bare `var()` is read as a colour (`DEFAULT_AMBIGUOUS_PREFIXES`). |
| `referencePrefixes` | Token namespaces a `var()` in markup is held to. `--color-` by default; a component's own `[--card-pad:…]` is not the token layer's to declare. |
| `checkReferences` | `false` to check classes only. |

The same call answers a second question the first one hides. `border-[var(--tab-indicator-height)]` is ambiguous to **Tailwind**, which resolves a bare `var()` on `border-*` to a colour and emits `border-color: 2px` — a declaration the browser drops. The underline tab had no indicator and the checkbox had no border, in production, with nothing red anywhere. The token's own value settles it, so `border-[var(--color-x)]` is never reported and the finding names the remedy:

```js
// [{ kind: "ambiguous arbitrary value", candidate: "border-b-[var(--tab-indicator-height)]",
//    token: "--tab-indicator-height" }]  →  border-b-[length:var(--tab-indicator-height)]
```

**What it does not see.** A token name assembled at runtime — `bg-${tone}`, `var(--color-${tone})`, a `Record` keyed by a prop — because nothing in the source spells the name, which is also why Tailwind cannot emit it; and a utility behind an arbitrary variant (`[&>svg]:text-x`). Nor whether a variable survives the build: Tailwind drops a `@theme` variable no source names, so one reached only through an assembled name resolves to nothing in the base theme while a `.dark` block, being a plain rule, still emits it. That asymmetry is not measurable from the token file, and `@theme static` is the answer to both.

Naming Tailwind's own `theme.css` among the `sources` is how a project keeps its built-in palette resolvable. Omitting it is how a project bans everything it did not declare.

## Design-system rules

### `no-raw-elements`

A design system is only a system where product code cannot reach past it. `<select>` written beside a `Select` gets the browser's metrics and the OS chevron — the split you see as a styled label above an unstyled control — and a raw `<button>` gets neither the focus ring nor the disabled semantics the primitive carries. This rule reports the raw element and names the primitive that owns what it drops.

It stays **off** until `primitives` names a design system, the way the token rules wait for a token layer: with no system to point at, every `<button>` in the project reports and no message can say what to write instead. `code-quality-setup --primitives=DIR` writes this section:

```js
configure({
  primitives: {
    source: "src/components/ui",
    importPath: "@/components/ui",
    rampClasses: ["fg-"]
  }
});
```

Options beside the severity tune that section rather than replacing it, so one rule's `exemptFiles` sits beside the shared source:

```js
configure({
  primitives: { source: "src/components/ui" },
  "no-raw-elements": ["warn", { exemptFiles: ["src/app/legacy/**"] }],
});
```

The default map is the form controls and the headings, each with the behaviour the primitive owns: `button` → `Button`, `select` → `Select`, `input` → `Input`, `textarea` → `Textarea`, `h1` → `PageHeader`, `h2`–`h4` → `CardTitle`. It is exported as `DEFAULT_PRIMITIVES`, and the map **is** the mechanism: an element absent from it is never judged.

Three things are not findings, so that the rule can run over a whole repository rather than one directory:

- **The primitive's own definition** — the file that *exports* it. `forms/input.tsx` exporting `Input`, `Select` and `Textarea` may render all three; `foundation/icon-button.tsx`, which exports `IconButton`, may not render a second `<button>`.
- **`<input type="hidden">` and `type="file"`.** Neither is a control a primitive can own — one is never rendered, the other is the OS file picker, whose button no stylesheet reaches. Per-element, as `exceptTypes`.
- **A heading carrying a ramp class**, where `rampClasses` names the project's prefixes. A section that owns its own `aria-labelledby` heading is not a card, and the ramp step is the thing `CardTitle` was there to supply. A class that is *not* a ramp step (`text-2xl`) does not open the escape.

Inside the design system — a directory named `ui`, `primitives` or `forms` (`DESIGN_SYSTEM`), or anything under `source` — the report is the other way round. A file there that renders `<button>` without exporting `Button` is asked to **add the variant to `Button`** and compose it, rather than to import it:

```
Raw <button> inside the design system, in a file that does not define Button. Add the
variant to Button and compose it here, rather than a second <button> carrying its own
copy of the focus ring and the disabled semantics.
```

That is where the drift starts: a segmented control, a menu row and an icon button each hand-rolling a focus ring is three rings to keep in step, and the primitive's `// the ONLY <button> in the app` comment stops being true inside its own directory. A control the primitive genuinely cannot become — one carrying `role="radio"` or `role="menuitem"` — takes the waiver, whose reason then records which control it is. `systemVariants: false` skips the system wholesale, for a project adopting the rule over its screens first.

Test files are relaxed from it, in the same `testGlobs` block that relaxes the per-function cap: a raw control in a test is a stub standing in for a screen, which no primitive's focus ring was ever going to reach.

With `source`, only a primitive the design system actually exports is a finding: a project whose system has no `Textarea` has nothing to point a report at, so the element it writes instead is not yet one. The barrel's `export { … }` and `export function` names are read once and cached (`primitiveExports()`); an unreadable source reports every element, rather than silently passing them.

A control no primitive models — a whole row that is one button, a selectable tile with `aria-pressed` — is waived at the site with a comment, in the same shape as `inline-warning: none —`:

```jsx
{/* primitive: none — the whole row is the control, and Button cannot carry a row's layout */}
<button onClick={open}>…</button>
```

The reason is mandatory: a bare marker waives nothing. One waiver covers the next raw element after it, so a second one below still reports.

| Option | Meaning |
| --- | --- |
| `primitives` | The element → `{ primitive, owns, exceptTypes }` map. Replaces `DEFAULT_PRIMITIVES` wholesale, which is how a project adds `table` → `DataTable` or drops an element it has no primitive for. |
| `source` | The design system's directory or barrel file. Exempts itself, and narrows reports to the primitives it exports. |
| `importPath` | How product code imports it (`@/components/ui`), for the message. Defaults to `source`. |
| `rampClasses` | Class-name prefixes that mark a heading as deliberately on the type ramp. Empty by default: the ramp's spelling is the project's. |
| `systemVariants` | Inside the system, judge each file and ask for a variant on the primitive. `true` by default; `false` skips the system wholesale. |
| `exemptFiles` | Paths the rule skips, matched by tail (`legacy/page.tsx` finds it at any depth) or as a glob (`src/app/legacy/**`), as in the token rules. |

## CI gate

The package installs a `code-quality-gate` bin. It lints the project with its own ESLint configuration and fails only on this plugin's rules **reported as errors**, so warnings and unrelated findings stay visible without gating a build. The blocking set is `RULE_IDS`, every rule this plugin owns, so a project that opted the design rules in at `error` is gated on them too rather than seeing them from `eslint` and not here.

Run `code-quality-gate --help` for the full flag list.

```json
{
  "scripts": {
    "lint:god-files": "code-quality-gate"
  }
}
```

Pass paths to narrow the scope: `code-quality-gate src test`.

A bare run is the full sweep. `code-quality.json` in the run directory settles every flag below plus [the four checks ESLint cannot answer](#stylesheet-colours-and-contrast), so a configured project passes no flags at all:

```json
{
  "allRules": true,
  "hook": false,
  "maxFilesPerDirectory": 10,
  "ignoreDirs": ["generated"],
  "ext": [".vue"],
  "inlineWarning": false,
  "tokenFile": "app/globals.css",
  "stylesheets": {},
  "sizes": {},
  "typeRamp": {},
  "contrast": {}
}
```

Every flag overrides its key for one run; `--config=FILE` names the file elsewhere and `--no-config` ignores it. `"hook": false` is the one key the gate does not read — it is how a project opts out of the [edit hook](#edit-hook-behavior), which is enabled once for every project.

### Gating on the project's own rules

`"allRules": true` in that config widens the first half of the gate from this plugin's rules to **every** rule the project sets to `error`:

```json
{ "allRules": true, "tokenFile": "app/globals.css" }
```

Without it, a project that sets `complexity` or `max-params` to `error` sees those findings from `eslint` and not from the gate, so a `lint` script running the gate alone does not gate them. With it, one command covers everything and the filter's protection is gone — an unrelated rule the project enables now fails the build too. That is the trade, and it is the project's to make.

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

### Stylesheet colours and contrast

The gate runs the design-token checks ESLint cannot answer — [stylesheets, contrast and unknown tokens](#what-eslint-cannot-see) — when it is pointed at a JSON config. Nothing runs without the flag, and every path *in the file* resolves against the file's own directory, so the config can live wherever it is kept. A section that names no `roots` sweeps the paths the gate itself was given, which are the caller's and stay relative to where it ran:

```sh
code-quality-gate    # reads code-quality.json
```

```json
{
  "tokenFile": "app/globals.css",
  "stylesheets": { "roots": ["app", "components"] },
  "sizes": { "roots": ["app", "components"] },
  "typeRamp": { "block": "@theme" },
  "contrast": {
    "roots": ["app", "components"],
    "themes": [
      { "name": "light", "blocks": ["@theme"] },
      { "name": "dark", "blocks": ["@theme", ".dark"] }
    ],
    "declaredPairs": [{ "fg": "--color-fg-muted", "bg": "--color-bg-1", "why": "row labels on a card" }],
    "allow": [{ "fg": "--color-border", "bg": "--color-bg-1", "why": "design: raising it re-draws every border" }]
  },
  "unknownTokens": {
    "roots": ["app", "components"],
    "themes": [
      { "name": "light", "sources": [{ "file": "node_modules/tailwindcss/theme.css" }, { "file": "app/globals.css", "block": "@theme" }] },
      { "name": "dark", "sources": [{ "file": "node_modules/tailwindcss/theme.css" }, { "file": "app/globals.css", "block": "@theme" }, { "file": "app/globals.css", "block": ".dark" }] }
    ]
  }
}
```

Every section may be omitted. `stylesheets` bans raw colours in CSS, `sizes` bans raw font sizes there, `typeRamp` checks that every ramp step declares its line height, and `contrast` measures every theme in `themes` — printing which ones it measured, and prefixing each finding with the theme it came from. Its `themes` also drive the redundant-override check, which needs no second declaration of a layering the project has already stated once. A `contrast` without `themes` measures one palette: `block` for a single theme out of the file, `sources` for one spread over several files. `unknownTokens` reports every utility and `var()` whose token no palette declares, naming the themes it is absent from. `stylesheets` and `sizes` always exempt `tokenFile`, alongside any `exemptFiles` of their own. Allowed contrast failures print on every run, like inline-error waivers; unresolvable or unknown tokens fail. A malformed config, a missing `tokenFile`, or an allow entry without a reason exits `2` rather than passing quietly.

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
- runs the file through the project's own `prettier` first, when prettier is one of its dependencies — so the rules judge the file a reviewer will read, and a formatting nit is never one of the errors blocking an edit. Through prettier's Node API rather than its CLI, because this runs after every edit and a second Node start would cost more than the whole check; the project's own prettier config and `.prettierignore` decide what is rewritten. A project without prettier is not formatted: choosing a formatter is not this plugin's call, and a prettier that fails is left to ESLint, which reports the same broken syntax with a location;
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
