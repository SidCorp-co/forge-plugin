# CLAUDE.md

**forge-plugin** — the Claude Code plugin for the Forge tracker: a CLI, the hooks that guard a
session, and the skills that drive both.

**Rules only.** Facts live in the code, mechanics in each tool's `-h`, history in `git`. A rule with
a checker is stated once — in the checker, whose message is what a developer reads when it fires.
Nothing here names a path or a script that does not resolve; `forge doctor` checks that. Install,
configuration, layout and which level a rule belongs to: [`README.md`](README.md). The CLI's
surface: [`docs/FORGE-CLI.md`](docs/FORGE-CLI.md). What each hook fires on:
[`docs/HOOKS.md`](docs/HOOKS.md).

## An entry point is not a library

A registered hook and a script under `plugin/scripts/` are entry points, and nothing imports an
entry point. Code a second one needs moves to `plugin/src/` before the second copy exists — nothing
checks the direction, and one script reaching into another is how it starts. Two exceptions are
imported widely and are not entry points: `plugin/hooks/_hook.mjs`, the harness every hook loads,
and `plugin/hooks/vendor/`, copies of `packages/code-quality/` — a plugin directory travels alone
and cannot import a sibling package. README says why.

## This code runs in repositories you cannot see

A hook fires in whatever project has the plugin installed, on a tree with its own gates, its own
default branch and its own idea of good code. So it may refuse a *shape* and never a style, it reads
configuration rather than assuming it, and it stays silent where a project has not decided. The
division and the case where both levels could speak:
`plugin/skills/issue-flow/references/two-levels.md`.

A refusal a developer cannot act on is a defect: say which shape was refused and what to do instead,
in the message itself.

## Vietnamese is the tracker's and the product's

Where a Vietnamese string may live is enforced. Everything that exemption leaves out is English —
comments, `docs/`, help text, errors, logs, commit messages — because a developer reads those, and
this is a developer's tool. Write the English source well: it is what someone will fix later.

The vi-natural skill is the route for the Vietnamese itself, and carries the reason.

## The half no gate reaches

The gates pin what gets *sent* to a model — placeholder accounting, segmentation, the shape of a
payload. What comes back is not diffable, so a change to a prompt, a style contract or an effort
level is verified by running it and reading the output. A green tree says the plumbing survived, not
that the answer is good.

## The live config directory is one environment variable away

`~/.config/forge/` holds a working token and the consult log. Anything exercising plugin state
points the `XDG_CONFIG_HOME` environment variable at a temporary directory first; a test that skips
it runs on the developer's own credential, then overwrites it.

## Verifying

Run `npm run check`. It stops at the first failure, so a passing run after a fix is the only
evidence the later gates ever ran — when one fails, fix it and run the rest too.

Fix the source, never the gate. A real violation that passes means the checker is wrong, and it gets
fixed in the same task rather than exempted.

A checker is only proven by watching it fire. One whose selector matches nothing looks exactly like
a clean repository, so a new rule ships with a case that fails without it.
