# Where every setting comes from, and what withholds a verb

Read this on the first call in a project, when a verb is missing, or before filing into a tracker
you have not filed into before. Nothing here changes between calls, which is why it is not in the
spine.

## Two scopes, and they are not the same scope

The **endpoint and token are the account's** — one Forge instance, one PAT — from
`~/.config/forge/config.json` and nowhere else. Not the environment, and not a `.mcp.json`: doctor
reports one of those naming a `forge` server, with the command that saves the same values.

The **slug is the project's**, from a `.forge.json` holding `{ "slug": "<project>" }`, and only from
there. A git worktree with no config of its own inherits its main checkout's.

The slug is demanded **only by a call that needs a project id**, so `tools` and `schema` answer in
a directory that belongs to no project. The project id is looked up from the slug and is never
configured.

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
look past the filter. `forge doctor` prints what resolves, from which source, and which
capabilities refuse.

## Prose language is the tracker's property

**By default the CLI posts what you hand it.** A tracker written in Vietnamese says so:

```json
{ "slug": "sid-growth", "translate": "vi" }
```

Then every `title`, `description` and `body` is rewritten by the bundled `vi-natural` before it is
posted and the CLI prints what went out — **write the source in English**, because a source that
stays English is the source to fix. If `vi-natural` fails or leaves a block untranslated, nothing
is posted at all. `translate` in `.forge.json` is what decides it, and the only thing that does.

Which is why SKILL.md sends you to `forge doctor` before a first filing: it prints the language and
its source, and the spine states what a wrong one costs.

The `vi-natural` skill in this same plugin covers writing Vietnamese directly, and its own
references cover the gateway, key and model that translation needs.
