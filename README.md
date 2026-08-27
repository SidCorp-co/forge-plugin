# forge-plugin

A Claude Code plugin holding two CLIs and their skills:

- **`forge`** — drive a Forge issue tracker over its own MCP HTTP endpoint, with no MCP client
  connected in the asking session. JSON-RPC over one POST.
- **`vi-natural`** — natural Vietnamese for i18n catalogs and docs. Absorbed here at v1.5.0
  because `forge` writes every issue through it; see `VI-NATURAL.md` for its own documentation.

## Install

```sh
claude plugin marketplace add /run/media/thanh/New/ai-project/forge-plugin
claude plugin install forge@forge-local
```

The `SessionStart` hook symlinks both binaries into `~/.local/bin`. After a fresh install, run
`plugin/hooks/link-cli.sh "$PWD/plugin"` once rather than waiting for the next session.

## Configuration

Two scopes, and they are not the same scope.

**Account** — the endpoint and the token. One Forge instance, one PAT, every project. Required by
every call:

1. `FORGE_MCP_URL` and `FORGE_TOKEN`
2. `mcpServers.forge` in the nearest `.mcp.json` walking up from the current directory
3. the same file in the main checkout, when the cwd is a linked git worktree

**Project** — the slug, and it is the only thing here that changes when you `cd`. Demanded lazily,
by the call that actually needs a project id, so `tools`, `schema`, `guide` and `call` against an
account-level tool work in a directory that belongs to no project:

1. `FORGE_PROJECT_SLUG`
2. `{ "slug": "<project>" }` in a `.forge.json` at or above the current directory
3. the `X-Forge-Project-Slug` header of that same `.mcp.json`

The project **id** is never configured — it is looked up from the slug at runtime.

`vi-natural` keeps its own config at `~/.config/vi-natural/config.json` (`vi-natural login --key`).

## Layout

```
.claude-plugin/marketplace.json   the local marketplace, name: forge-local
plugin/
  .claude-plugin/plugin.json      the plugin manifest, name: forge
  bin/forge  bin/vi-natural       PATH entry points, symlink-resolving
  hooks/                          SessionStart link-cli.sh, nothing else
  src/*.mjs                       the forge CLI
  scripts/vi_natural.py  vi_cli/  the vi-natural CLI
  skills/forge  skills/vi-natural
```
