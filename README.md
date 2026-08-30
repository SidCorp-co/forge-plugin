# forge-plugin

A Claude Code plugin holding two CLIs and their skills:

- **`forge`** — drive a Forge issue tracker over its own MCP HTTP endpoint, with no MCP client
  connected in the asking session. JSON-RPC over one POST.
- **`vi-natural`** — natural Vietnamese for i18n catalogs and docs. Absorbed here at v1.5.0
  because `forge` writes every Vietnamese issue through it; see `VI-NATURAL.md` for its own
  documentation.

## Install

```sh
claude plugin marketplace add .          # from a checkout of this repo
claude plugin install forge@forge-local
```

The `SessionStart` hook symlinks both binaries into `~/.local/bin`. After a fresh install, run
`node plugin/hooks/link-cli.mjs "$PWD/plugin"` once rather than waiting for the next session.

`install` **copies** this tree into `~/.claude/plugins/cache/forge-local/forge/<version>/`, and the
symlinks point there. `claude plugin update` compares versions only, so an edit made without
bumping `plugin.json` never reaches the cache — bump the version, or uninstall and install again.

## Configuration

Two scopes, and they are not the same scope.

**Account** — the endpoint and the token. One Forge instance, one PAT, every project. Required by
every call:

1. `FORGE_MCP_URL` and `FORGE_TOKEN`
2. `~/.config/forge/config.json`, written by `forge doctor --token <pat> --url <endpoint>` at
   mode 0600 — a token belongs outside every repository
3. `mcpServers.forge` in the nearest `.mcp.json` walking up from the current directory, or the
   same file in the main checkout when the cwd is a linked git worktree

**Project** — everything a tracker decides for itself, in a `.forge.json` at its root:

```json
{
  "slug": "sid-growth",
  "translate": "vi",
  "deps": { "marker": "those edges are recorded", "blockedBy": "blocked by", "blocks": "blocks" }
}
```

`slug` also comes from `FORGE_PROJECT_SLUG` or the `.mcp.json` header, and is demanded only by a
call that needs a project id. `translate` is off unless set — a wrong-language issue cannot be
withdrawn, and `FORGE_TRANSLATE` overrides per command. `deps` is optional and defaults to the
English sentence shown.

The project **id** is never configured — it is looked up from the slug at runtime.

`forge doctor` prints every one of these, says which source answered, and reaches the endpoint.
Run it first when anything refuses.

### What else lives in `~/.config/forge/`

`config.json` also holds two keys `doctor` writes and the rest of the CLI reads:

- **`capabilities`** — per project, which tools refused this credential and when. The usage list,
  `forge tools` and `forge schema` withhold anything recorded here, so **a verb can be missing
  from `forge -h` because of this file.** `forge tools --all` looks past it.
- **`withheld`** — verbs a human hid with `forge doctor --hide <verb>`. Unlisted, but they still
  run. `forge doctor --show <verb>` puts one back.

`tools-<hash>.json` beside it caches the server's 130 KB tool declaration, keyed by endpoint. It is
refreshed when a name lookup misses and on every `forge doctor` run; deleting it costs one slow
call, never a wrong answer.

`vi-natural` keeps its own key at `~/.config/vi-natural/config.json` (`vi-natural login --key`).

## Layout

```
.claude-plugin/marketplace.json   the local marketplace, name: forge-local
plugin/
  .claude-plugin/plugin.json      the plugin manifest, name: forge
  bin/forge  bin/vi-natural       PATH entry points, symlink-resolving
  src/                            the forge CLI
    cli.mjs          argv, the usage list, the write-time rules
    visibility.mjs   the verb table, and what this credential may see
    commands.mjs     one function per verb
    issues.mjs       paging, the browse projection, ISS-45 -> uuid
    rpc.mjs          transport, retry, the cached tool surface, the write boundary
    settings.mjs     every setting, resolved to { value, from }
    config.mjs       ~/.config/forge, at 0600
    deps.mjs  doctor.mjs  vi.mjs  flags.mjs  suggest.mjs
  hooks/
    _hook.mjs             the event, the files a call wrote, deny/block, the once-per-session stamp
    bash-guard.mjs        PreToolUse: the shell commands that cannot be undone
    learning-gate.mjs     PreToolUse: one stop before a memory or skill write
    code-quality.mjs      PostToolUse: every written code file, to the project's own linter
    derive-dont-list.mjs  PostToolUse: one nudge when a checker hard-codes its cases
    link-cli.mjs          SessionStart: both binaries onto PATH
    vendor/               the upstream lint script, copied — see below
  scripts/
    skill-dup.mjs         text a skill says twice
    migration-risk.mjs    a migration classified by whether deploying it can be undone
    check-vendor.mjs      drift between vendor/ and the upstream it came from
    vi_natural.py  vi_cli/   the vi-natural CLI, still python
  skills/forge  skills/vi-natural  skills/issue-flow
  skills/audit-code-quality  skills/setup-code-quality
```

## Two levels

This plugin is the **global** level. It owns *when and where* a rule fires — which tool routes are
watched, which directories are in scope. It owns no rule about what good code is.

A **project** owns that. Its eslint config, its thresholds, its gates. Which level a rule belongs
to, and what happens where both could speak, is stated once in
`plugin/skills/issue-flow/references/two-levels.md`.

`code-quality.mjs` is the arrangement in one file. It finds every file a call wrote — including
through the shell, which is the route `Edit|Write|MultiEdit` matchers miss — and hands each one to
`eslint-plugin-code-quality`'s own hook script, which resolves the project's workspace, eslint
binary and config. The project's copy in `node_modules` is preferred; `hooks/vendor/` is the
fallback for a project that never installed it. A project with no eslint is silent either way.

The vendored copy is a copy on purpose: that script is built to travel alone into a plugin cache,
and its own header says so. `scripts/check-vendor.mjs` compares it against upstream when upstream
is on this machine, and says which commit it was pinned at when it is not.
