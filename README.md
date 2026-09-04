# forge-plugin

A Claude Code plugin holding two CLIs and their skills:

- **`forge`** — drive a Forge issue tracker over its own MCP HTTP endpoint, with no MCP client
  connected in the asking session. JSON-RPC over one POST.
- **`vi-natural`** — natural Vietnamese for i18n catalogs and docs. Absorbed here because
  `forge` writes every Vietnamese issue through it; see `VI-NATURAL.md` for its own
  documentation and for the reasoning its client encodes.

What the two of them owe, clause by clause under an identifier an issue can cite, is
`docs/requirements/README.md` — a BRD over an SRS. The failures and measurements behind `forge`'s own
shape are an index of one row per topic at `docs/FORGE-CLI.md`, each row naming the file that holds
that topic. That document also holds the rules of the
tree and the steps another project follows to adopt it.

## Install

```sh
claude plugin marketplace add .          # from a checkout of this repo
claude plugin install forge@forge-local
```

The `SessionStart` hook symlinks both binaries into `~/.local/bin`. After a fresh install, run
`node plugin/hooks/link-cli.mjs "$PWD/plugin"` once rather than waiting for the next session.

One symlink serves the machine and the session that wrote it last decided where it points, so what
it runs is decided per call instead: inside a checkout of this plugin, that checkout; anywhere else,
the newest installed copy. A tree mid-refactor is therefore nobody else's problem, and `forge
doctor` names the copy a call from the current directory would run.

`install` **copies** this tree into `~/.claude/plugins/cache/forge-local/forge/<version>/`, and the
symlinks point there. `claude plugin update` compares versions only, so an edit made without
bumping `plugin.json` never reaches the cache — bump the version, or uninstall and install again.

## Configuration

Two scopes, and they are not the same scope.

**Account** — the endpoint and the token. One Forge instance, one PAT, every project. Required by
every call, and read from exactly one place: `~/.config/forge/config.json`, written by
`forge doctor --token <pat> --url <endpoint>` at mode 0600, because a token belongs outside every
repository.

Not the environment, and not a `.mcp.json`. Every additional source is a precedence rule to
remember, a report that has to say which one answered, and — for credentials that answer by
directory — an account setting that is the account's in name only. A `.mcp.json` naming a `forge`
server is reported by `forge doctor` with the command that saves the same values properly.
`XDG_CONFIG_HOME` moves all of it, and is how a test runs on state that is not yours.

**Project** — everything a tracker decides for itself, in a `.forge.json` at its root:

```json
{
  "slug": "sid-growth",
  "translate": "vi",
  "deps": { "marker": "those edges are recorded", "blockedBy": "blocked by", "blocks": "blocks" },
  "codex": { "pathRe": "^(plugin|packages)/(src|hooks|scripts)/.*\\.mjs$|^docs/.*\\.md$" }
}
```

`slug` is read from that file alone and is demanded only by a call that needs a project id.
`translate` is off unless set — a wrong-language issue cannot be withdrawn. `deps` is optional
and defaults to the English sentence shown. `codex.pathRe` decides which of a turn's writes are
worth a second opinion, and belongs here rather than in the account's config: a docs tree and a
code tree do not want the same answer. `forge codex show` names which of the three levels
answered.

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
feedback/                         one Markdown file per note from an agent using the CLI anywhere;
                                  the shape is in its README, the path is in `forge -h`
plugin/
  .claude-plugin/plugin.json      the plugin manifest, name: forge
  bin/forge  bin/vi-natural       PATH entry points; reached through the link, they dispatch
  guides/issue-flow-contract.md   the contract a status is earned under, served a part at a time
  src/                            the forge CLI
    cli.mjs          argv, the usage list, the write-time rules
    dispatch.mjs     which copy a call through the PATH link runs
    commands.mjs     one function per verb
    suggest.mjs      the near miss every refusal offers
    flow/            the lease, the typed records, what each status is earned by
    tracker/         paging, the browse projection, ISS-45 -> uuid, transport,
                     retry, the cached tool surface, the write boundary, and the
                     contract above cut at its own headings
    codex/           the consult, its tools, its log and what it owes
    checks/          what this tree holds its own documents and code to
    hooks/           the refusal log and the per-hook switch, shared with hooks/
    tools/           cloudflare, vi-natural, doctor, which copy is running
    spec/            the requirements tree, answered by identifier
    resolve/         what this run is: settings to { value, from }, ~/.config/forge
                     at 0600, the flag parser, and the verb table deciding what
                     this credential may see
  hooks/
    _hook.mjs             the event, the files a call wrote, deny/block, the once-per-session stamp
    link-cli.mjs          SessionStart: both binaries onto PATH
    entries/              one registered line each, running one gate alone
      bash-guard.mjs        PreToolUse: the shell commands that cannot be undone
      learning-gate.mjs     PreToolUse: one stop before a memory or skill write
      learning-landed.mjs   PostToolUse: one that arrived by a route no shape reads
      code-quality.mjs      PostToolUse: every written code file, to the project's own linter
      derive-dont-list.mjs  PostToolUse: one nudge when a checker hard-codes its cases
    vendor/               copies of packages/code-quality — see below
  scripts/
    skill-dup.mjs         text stated twice — a skill's prose, or a tree's comments
    migration-risk.mjs    a migration classified by whether deploying it can be undone
    check-vendor.mjs      drift between vendor/ and packages/code-quality
  vi-natural/             the vi-natural CLI
    cli.mjs               argv, usage, dispatch
    vi-text.mjs           the Vietnamese style contract — the only file holding prose
    text/                 prompts, CTA discipline, placeholder accounting
    format/               order-preserving JSON, locale trees, Markdown segmentation
    gateway/              config, the streaming client, the batch engine with its gate
    commands/             one file per verb
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
and its own header says so. Its source is `packages/code-quality/`, this repository's own package
rather than somebody else's release, so `scripts/check-vendor.mjs` compares the two on every
`npm run check` — code rather than commit id — and a source that is not there fails as a broken
tree, not as an absent checkout. `npm run check` runs that package's own lint and tests too.
