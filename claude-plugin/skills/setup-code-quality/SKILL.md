---
name: setup-code-quality
description: Set up eslint-plugin-code-quality, its limits, and its Claude Code edit hook in the current Node project. Use when the hook reports a missing plugin or configuration, when a project has no ESLint at all, or when the user asks to install or configure code-quality linting.
version: 0.6.0
---

# Set up code-quality linting

`code-quality-setup` does every mechanical step. Yours is the severities: ask them first, run it
once, report what it found.

## 1. Ask, one rule per question — every time

`AskUserQuestion`, one question per rule, options **error / warn / off** — in rounds of four, in
this order. Never bundle them into a single "severity" question, and never assume a default.

**Ask even when the project is already configured.** An existing config is context, not an answer:
read the current severities first (`npx eslint --print-config <a real source file>`) and mark each in
the option description — "currently error" — then ask anyway. The answers are authoritative, and the
script rewrites the `configure()` call in place rather than skipping it.

| Ask about | What it catches | Off means |
| --- | --- | --- |
| `no-historical-narration` | comments narrating what the code used to do | history stays in comments |
| `comment-density` | more than 15% comment lines | prose is uncapped |
| `max-consecutive-comment-lines` | a block over 8 comment lines | essays stay inline |
| `no-pass-through-wrapper` | a layer that forwards and adds nothing | indirection is free |
| `max-lines` | files over 500 code lines | god files are allowed |
| `max-lines-per-function` | functions over 150 code lines | so are god functions |
| `no-raw-colors`, `no-arbitrary-sizes` | `#fff` and `text-[13px]` outside the token layer | ask only if step 2 found tokens |
| `no-raw-elements` | `<select>` and `<h1>` written beside a `Select` and a `PageHeader` | ask only if step 2 found a design system |

Then one more: **the hook** — check each file Claude Code edits, on or off. On means the file is run
through the project's own `prettier` when it has one, then linted, and a failing edit is blocked with
the remedy; off means findings wait for the gate. It is enabled once for every project this user
opens, so "off" here writes one project's opt-out, not a global change.

The hook formats only where `prettier` is already a dependency — installing a formatter is not this
plugin's call. Mention it if the project has none.

## 2. Find the token layer and the design system, before asking about the design rules

```sh
grep -rlE "^\s*@theme|^\s*--[a-z-]+:\s*#" --include=*.css . | grep -v node_modules
```

Nothing found: say so, skip those two questions, pass no `--tokens`. They report every `#fff` in a
project with nowhere to put it.

The design system is the directory the primitives are exported from — a barrel beside them:

```sh
ls -d **/components/ui **/components/primitives 2>/dev/null | grep -v node_modules
```

Nothing found, or a directory with no `index.*`: skip that question and pass no `--primitives`.
Without a system to point at, `no-raw-elements` reports every `<button>` and no message can say what
to write instead. Where one exists, `--primitives=DIR` is enough — it exempts itself, and reports
only the primitives it exports. Two options are left to write by hand afterwards if the project needs
them: `importPath` (how product code imports it, e.g. `@/components/ui`, for the message) and
`rampClasses` (the class prefixes that mark a heading as deliberately on the type ramp).

## 3. Run it once

```sh
npx code-quality-setup --comment-density=warn --max-lines=error … \
  --tokens=app/globals.css --hook=on [--all-rules] [--dry-run]
```

A project that installed the plugin before this binary existed has no `node_modules/.bin` entry for
it — that list is written at install time — so `npx` reaches the registry and 404s on an unpublished
package. Run the file by path instead; nothing here is compiled, so it needs no install and no
rebuild:

```sh
node node_modules/eslint-plugin-code-quality/bin/code-quality-setup.mjs …
```

It picks the package manager off the lockfile, installs `eslint` plus a parser if the project is
TypeScript, links this checkout (`link:` for pnpm, which has no global link and copies a `file:`
into its store), writes `eslint.config.mjs` and `code-quality.json`, adds a `lint:code-quality`
script, and finishes with a gate run whose counts are the report. `--dry-run` prints all of it and
writes nothing.

`--all-rules` gates on the rules the *project* enables at error too, not just this plugin's. Offer
it whenever the project has correctness rules of its own — without it, a `lint` script running the
gate alone leaves them to `eslint` and never fails on them.

## 4. Two things the script will not do

**A config that assembles this plugin some other way is reported, not rewritten** — only a
`configure()` call is the script's to replace. It prints the call to merge; spread it **last**, and
delete the project's own `max-lines`, `max-lines-per-function`, `max-statements`, and comment-style
rules, because those ids are this plugin's and flat config is silently last-wins.

**TypeScript 7 breaks `@typescript-eslint/parser`**, which throws `does not support TS 7.0` at
module load. Never downgrade TypeScript for a linter; use `@babel/eslint-parser` with
`@babel/preset-typescript` instead — it never loads `typescript` — and give `.tsx`/`.jsx` the JSX
plugin but not `.ts`, where `<T,>(v: T) => v` reads as an unclosed element.

## 5. Report

The gate's own two lines are the proof a run reached something: `N files · N packages`, and
`design tokens · …` when step 2 found a layer. A missing count is a config that swept nothing, not
a clean project. Name the findings by rule, point at `/code-quality:audit-code-quality` to work
through them, and never commit a red gate.

These rules read comments, size, and literals only. If `npx eslint --print-config <file>` shows
nothing but `code-quality/*`, `max-lines`, and `max-lines-per-function`, say so: the project has no
correctness lint at all. `eqeqeq`, `no-unreachable`, `no-redeclare`, `prefer-const`, `complexity`,
`max-depth`, and `max-params` overlap nothing here. Core `no-unused-vars` is not one of them — it
cannot see a constructor parameter property and reports every dependency injection in the repo;
that job is `tsc`'s, with `noUnusedLocals` and `noUnusedParameters`.
