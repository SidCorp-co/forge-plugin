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

**Run `forge -h` first.** It lists the verbs *this* credential can actually use, and `forge <verb>
-h` names the schema holding one's arguments in full. Nothing about their shapes is repeated here.
What follows is how to spend a call well; what is read once is in `references/`, named at the point
it becomes relevant.

When this plugin is the problem — a refusal with no route, a flag that did not do what its help
said, a hook that fired on the right shape, a call it made you spend twice — `forge feedback` files
it as a bug on the plugin's own project, from whatever project you are standing in, **before** you
work around it. A workaround nobody filed is a defect nobody fixes.

## Spend the call, not the context

A round trip is about twenty bytes of command; the payload is the cost. Two consequences worth
knowing before the first call.

**Pass a path when the content already exists, and never create a file to pass one.** Measured on a
3,895-character body: an existing file costs 153 characters against 4,202 inline — but *writing*
that file in the same breath costs 4,078, within 3% of inlining.

**Fetch narrow, then fetch again.** One part of one body is 21× cheaper than the whole. Measured on
a 50-issue tracker, the list costs 6,602 bytes against ~1,700 for a single body, so drilling into 48
of the 50 one at a time still costs less than one call that returned them all.

`ISS-45` works wherever a uuid does — including inside a raw `call` payload, in `documentId`,
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
