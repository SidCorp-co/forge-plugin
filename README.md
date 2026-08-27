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

`forge` resolves its endpoint, token and project slug in this order:

1. `FORGE_MCP_URL`, `FORGE_TOKEN`, `FORGE_PROJECT_SLUG`
2. the nearest `.mcp.json` walking up from the current directory, `mcpServers.forge`
3. the `.mcp.json` of the main checkout, when the cwd is a linked git worktree

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
