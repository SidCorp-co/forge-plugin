---
name: forge
description: >-
  Drive a Forge issue tracker from the terminal with the `forge` CLI — browse, read, file,
  comment on and attach to issues without an MCP client connected. Invoke for any task that
  reads or writes the backlog: listing open issues, filing a defect, posting a finding,
  recording a dependency, or reading an issue body before working it. Triggers on Forge,
  tracker, backlog, issue, ISS-nn, "file an issue", "what's open".
---

# Skill: forge

**Run `forge -h` first.** It lists the verbs *this* credential can actually use and carries the
tracker's own rules for writing an issue. This document explains the parts `-h` cannot.

## Two scopes, and they are not the same scope

The **endpoint and token are the account's** — one Forge instance, one PAT — from `FORGE_MCP_URL`
and `FORGE_TOKEN`, else `~/.config/forge/config.json`, else the `forge` server in the nearest
`.mcp.json` walking up from the current directory.

The **slug is the project's**, from `FORGE_PROJECT_SLUG`, else a `.forge.json` holding
`{ "slug": "<project>" }`, else that file's `X-Forge-Project-Slug` header. A git worktree with no
config of its own inherits its main checkout's.

The slug is demanded **only by a call that needs a project id**, so `tools` and `schema` answer in
a directory that belongs to no project. The project id is looked up from the slug and is never
configured. **Never pass a project id, a slug or a token on the command line.**

## `forge -h` may be missing verbs, and that is deliberate

An agent is offered what it can use and nothing else. A verb disappears for one of two reasons:

- **The server refuses its backing tool.** `forge doctor` probes and records that; the verb then
  leaves the usage list, `forge tools` stops listing the tool, and `forge schema` refuses to print
  its arguments. On this deployment `forge_project_pm` answers `FORBIDDEN: PM_REQUIRES_DEVICE`, so
  `dep` is normally absent — edge writes need a device credential, not a PAT.
- **A human ran `forge doctor --hide <verb>`.** That one is unlisted but still runs;
  `forge doctor --show <verb>` puts it back.

Nothing is filtered until `doctor` has measured it, and every refusal carries the date it was
measured rather than claiming a permanent fact. `forge tools --all` and `forge schema <tool> --all`
look past the filter. **If a verb you expected is missing, run `forge doctor`** — it prints what
resolves, from which source, and which capabilities refuse.

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

## Dependencies are prose, not edges

No PAT can read or write the recorded dependency graph — every `forge_project_pm` action refuses,
and `forge_issues get` returns no relation among its keys. `data.relations` on an `update` is worse
than a refusal: schema-validated, then discarded, returning 200 (forge-dev ISS-868).

`forge deps [ISS-45] [--long]` is the substitute. It reads the sentence a migrated issue carries
about its own edges and prints one ASCII line per blocker:

```
ISS-7  -> ISS-8 ISS-9 ISS-10? ISS-11
ISS-8  -> ISS-9 ISS-11
```

**A `?` suffix means only one of the two issues claims that edge** — the finding, never reconciled
away. A phrase matching no title, or tying two, prints unresolved rather than guessed, and the run
reports how many issues carry no such prose, because that is silence and not an absence of
dependencies. The sentence it looks for defaults to English and is configurable per tracker with
`deps: { marker, blockedBy, blocks }` in `.forge.json`.

Forge's own `agent-setup` guide names **`prose-deps`** as a red flag: *only the edge gates dispatch;
prose gates nothing.* Treat `forge deps` as a reading of what the bodies claim, never as dispatch
truth.

## Prose language is the tracker's property

**By default the CLI posts what you hand it.** A tracker written in Vietnamese says so:

```json
{ "slug": "sid-growth", "translate": "vi" }
```

Then every `title`, `description` and `body` is rewritten by the bundled `vi-natural` before it is
posted and the CLI prints what went out — **write the source in English**, because a source that
stays English is the source to fix. If `vi-natural` fails or leaves a block untranslated, nothing
is posted at all. `FORGE_TRANSLATE=vi|off` overrides per command.

**Check `forge doctor` before filing into an unfamiliar project.** It prints the prose language and
its source. Posting the wrong language is unrecoverable: `forge_issues` has no delete action, and
so is posting into the wrong project — every write announces its target before it goes.

The `vi-natural` skill in this same plugin covers writing Vietnamese directly.
