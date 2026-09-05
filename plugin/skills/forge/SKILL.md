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

## Rules

- `forge -h` lists the verbs this credential can use, and `forge <verb> -h` owns the arguments.
  Nothing about a payload's shape is repeated here.
- Pass a path when the file exists. Never write a file to have one to pass.
- Read one field of one body before the whole: `forge issue ISS-45 --fields status,plan`.
- `ISS-45` works wherever a uuid does, inside a raw `call` payload too.
- Write English. A tracker that reads Vietnamese says so in its config, and the CLI rewrites what
  you hand it.
- Never pass a project id, a slug or a token on the command line.
- A verb you expected and cannot see is withheld on purpose: `forge doctor` says by what.
- When this plugin is the problem, file it before working around it: `forge feedback`, from any
  project, no lease.

## Route

| you want | run |
|---|---|
| list, read, search issues | `forge issues -h`, `forge issue -h` |
| file, comment, attach | `forge new -h`, `forge comment -h`, `forge attach -h` |
| a plan, a lease, a record, a status move | `forge plan -h`, `forge claim -h`, `forge record -h`, `forge advance -h` |
| the next issue to work | `forge next -h` |
| what blocks what | `forge deps -h`; reading the graph: `forge guide forge dependencies` |
| Cloudflare zones, DNS, purges | `forge cloudflare -h`; the method: `forge guide forge cloudflare` |
| a second opinion on this turn | `forge codex -h`; asking and reading one: `forge guide forge codex` |
| a first call in a project, a missing verb | `forge doctor`; then `forge guide forge configuration` |
| what a gate refused and why | `forge hooks -h` |
| anything the verbs do not wrap | `forge tools`, `forge schema <tool>`, `forge call -h` |
