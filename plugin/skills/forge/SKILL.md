---
name: forge
description: >-
  Drive a Forge issue tracker from the terminal with the `forge` CLI — browse, read, file,
  comment on and attach to issues without an MCP client connected. Invoke for any task that
  reads or writes the backlog: listing open issues, filing a defect, posting a finding,
  recording a dependency, or reading an issue body before working it. The same CLI carries
  `forge cloudflare` for zones, DNS records and cache purges, and `forge codex` for a review
  of this turn's documents by a model on another provider. Triggers on Forge, tracker,
  backlog, issue, ISS-nn, "file an issue", "what's open", Cloudflare, DNS record, zone,
  purge cache, "second opinion", "review this plan", codex.
---

# Skill: forge

**Run `forge -h` first.** It lists the verbs *this* credential can actually use and carries the
tracker's own rules for writing an issue. What follows is how to spend a call well. What is read
once — where settings come from, what `doctor` reports, and the two verb families that are not the
tracker — is in `references/`, named at the point it becomes relevant.

## Payloads: inline, `@file`, or `-`

One rule everywhere a payload is taken. `forge new report.md`, `forge new @report.md`,
`forge new - < report.md`, `forge call forge_issues '{"action":"list"}'`,
`forge call forge_issues @args.json`.

Pass a path when the content already exists. Measured on a 3,895-character body: an existing file
costs 153 characters against 4,202 inline — but *writing* that file in the same breath costs 4,078,
within 3% of inlining. Never create a file just to pass it.

## Fetch narrow, then fetch again

Three tiers, and the payload is what costs — a round trip is ~20 bytes of command:

- `forge issues [--status s] [--search q] [--limit n]` — one line per issue: `ISS-45  open  title`.
- `forge issue ISS-45` — one whole body, empty fields omitted.
- `forge issue ISS-45 --fields plan` — one part of one body. **21× cheaper** than the whole.

Measured on a 50-issue tracker: the list is 6,602 bytes against ~1,700 for a single body, so
drilling into 48 of the 50 one at a time still costs less than one call returning them all.

**`issues` returns one page.** The server's default is 25; this CLI asks for 200 and `--limit` caps
at 500. There is no cursor, so a count equal to the limit means rows were left behind — the CLI
says so on that line. Filters and `--fields` are validated against the server's own schema before
the call, so a typo answers `Did you mean: --status?` rather than costing a round trip.

**`ISS-45` works wherever a uuid does** — including inside a raw `call` payload, in `documentId`,
`dependsOnId`, `blocksId`, `fromIssueId` and `toIssueId`.

## Before a write

Every write announces its target before it goes, and `forge_issues` has no delete action, so
posting into the wrong project — or in the wrong language — is unrecoverable. A tracker written in
Vietnamese says so in its own config and the CLI rewrites what you hand it, which is why the
source you write is **English**. Filing into a project for the first time, run `forge doctor` and
read the language and the slug it prints: `references/configuration.md`.

**Never pass a project id, a slug or a token on the command line.**

## A verb that is missing is missing on purpose

An agent is offered what it can use and nothing else, so `forge -h` is shorter than the CLI. Which
two things withhold a verb, and how to look past both: `references/configuration.md`. **If a verb
you expected is missing, run `forge doctor`.**

## Reference material

Read one when you are in it, not before this line.

| file | when |
| ---- | ---- |
| [`references/configuration.md`](references/configuration.md) | first call in a project, a missing verb, an unfamiliar tracker |
| [`references/dependencies.md`](references/dependencies.md) | `forge deps`, or any question about what blocks what |
| [`references/cloudflare.md`](references/cloudflare.md) | `forge cloudflare` — zones, DNS records, cache purges |
| [`references/codex.md`](references/codex.md) | `forge codex` — asking for a second opinion, and reading one |
