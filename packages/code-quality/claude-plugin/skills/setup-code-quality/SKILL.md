---
name: setup-code-quality
description: Set up eslint-plugin-code-quality, its limits, and its Claude Code edit hook in the current Node project. Use when the hook reports a missing plugin or configuration, when a project has no ESLint at all, or when the user asks to install or configure code-quality linting.
version: 0.7.0
---

# Set up code-quality linting

`code-quality-setup` does every mechanical step. Yours is the severities: look first, ask them, run
it once, report what it found.

## 1. Find the token layer and the design system

This comes first because it decides which questions step 2 asks.

```sh
grep -rlE "^\s*@theme|^\s*--[a-z-]+:\s*#" --include=*.css . | grep -v node_modules
ls -d **/components/ui **/components/primitives 2>/dev/null | grep -v node_modules
```

Nothing found for either: say so, and pass neither `--tokens` nor `--primitives`. Those rules report
every `#fff` and every `<button>` in a project with nowhere to put them. What counts as a design
system, and the two options left to write by hand: `references/discovery.md`.

## 2. Ask, one rule per question — every time

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
| `no-raw-colors`, `no-arbitrary-sizes` | `#fff` and `text-[13px]` outside the token layer | ask only if step 1 found tokens |
| `no-raw-elements` | `<select>` and `<h1>` written beside a `Select` and a `PageHeader` | ask only if step 1 found a design system |

Then one more: **the hook** — check each file Claude Code edits, on or off. On means the file is run
through the project's own `prettier` when it has one, then linted, and a failing edit is blocked with
the remedy; off means findings wait for the gate. It is enabled once for every project this user
opens, so "off" here writes one project's opt-out, not a global change.

The hook formats only where `prettier` is already a dependency — installing a formatter is not this
plugin's call. Mention it if the project has none.

## 3. Run it once

```sh
npx code-quality-setup --comment-density=warn --max-lines=error … \
  --tokens=app/globals.css --hook=on [--all-rules] [--dry-run]
```

A 404 from `npx` means the package is not in the registry, not that it is missing here — run the file
by path instead, which needs no install because nothing here is compiled:

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

A config that assembles this plugin some other way is reported rather than rewritten, and TypeScript
7 breaks the usual parser. Both have a fixed remedy: `references/edge-cases.md`.

## 5. Report

The gate's own two lines are the proof a run reached something: `N files · N packages`, and
`design tokens · …` when step 1 found a layer. A missing count is a config that swept nothing, not
a clean project. Name the findings by rule, point at `/code-quality:audit-code-quality` to work
through them, and never commit a red gate.

If the project turns out to have no correctness lint at all, say so — which rules that means, and
which one not to suggest: `references/edge-cases.md`.

## Reference material

| file | when |
| ---- | ---- |
| [`references/discovery.md`](references/discovery.md) | step 1 found something, or found nothing and you need to be sure |
| [`references/edge-cases.md`](references/edge-cases.md) | the script reported a config it will not touch, a parser threw, or the report needs the coverage gap |
