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

`forge` is on PATH. It is global but **project-scoped**: the endpoint, the token and the project
slug come from the nearest `.mcp.json` walking up from the current directory, and the project id
is looked up from that slug at runtime. A git worktree with no `.mcp.json` of its own inherits its
main checkout's. `FORGE_MCP_URL`, `FORGE_TOKEN` and `FORGE_PROJECT_SLUG` override all of it.

**Never pass a project id, a slug or a token on the command line.** An id typed into a command is
the same hard-coded environment fact whether it sits in a script or in a shell history.

## The verbs

Run `forge -h` for the list. The shape that matters:

- `forge issues [--status open] [--search q] [--label l] [--limit n]` — the browse projection,
  one line per issue: `ISS-45  open  <uuid>  <title>`.
- `forge issue <uuid|ISS-45>` — the full body. Both references work; the uuid costs one call less.
- `forge new <file.md|-> --title T [--status S] [--priority P]` — file one. Body from a file or
  stdin, `--title` required, `open` unless `--status` says otherwise.
- `forge comment <uuid|ISS-45> <file.md|->` — post a comment.
- `forge attach <issue|comment> <uuid> <file>...` — upload bytes straight to a presigned URL.
  **Use this for anything bigger than a snippet**; base64 through a model's context is the defect
  it exists to avoid.
- `forge tools`, `forge schema <tool>`, `forge call <tool> '<json>'` — anything not wrapped above.
  `call` still routes `data` through the Vietnamese pipeline, so it is not a bypass.

## Two things the output will not tell you

**`issues` returns one page.** The server's default is 25 rows; this CLI asks for 200 and the
schema caps `--limit` at 500. There is no offset or cursor, so a count that equals the limit means
rows were left behind — the CLI says so on that line. A count below the limit is the whole set.

**`issueId` and `documentId` are different keys.** `ISS-45` is what a human cites; the uuid is
what the API takes. `issue`, `comment`, `attach issue` and `dep` accept either.

## Prose goes in English

Every `title`, `description` and `body` is rewritten by the bundled `vi-natural` before it is
posted, and the CLI prints what went out. **Write the source in English** — a source that stays
English is the source to fix, not a reason to hand-translate. If `vi-natural` fails or leaves a
block untranslated, nothing is posted at all.

The `vi-natural` skill in this same plugin covers writing Vietnamese directly.
