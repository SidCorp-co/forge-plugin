# forge-plugin

A Claude Code plugin holding two CLIs and their skills:

- **`forge`** — drive a Forge issue tracker over its own REST API, with no MCP client connected in
  the asking session. Every capability it has is a request, and one that has no route is refused
  rather than carried another way.
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

**Machine** — what a harness service on this box reaches, beside the account's pair in the same
file, each written by `forge doctor`:

```
forge doctor --codex-url <endpoint> --codex-key <key>
forge doctor --vi-url <endpoint> --vi-key <key> --vi-model <id>
forge doctor --chatgpt-url <endpoint> --chatgpt-key <key> --chatgpt-prefix <framing>
```

Two of those services had a file of their own before this one did and still answer from it where the
key here is unset: the reviewer's gateway from `~/.claude/claude-proxy.env`, the Vietnamese gateway
from the file `vi-natural login` writes. That is the one precedence rule this product keeps, and
what buys it is not optional — every row `forge doctor` prints for one of these names the file that
answered for it, so the fallback can be undone by whoever meets it. A change that drops the naming
drops the fallback with it.

`~/.claude/claude-proxy.env` is read here and written nowhere. A shim outside this repository reads
it too, and Claude Code consumes its `ANTHROPIC_*` values as environment, where the model slots
decide which model a subagent's `model:` frontmatter spawns on — so the slot a consult resolves
through is still read from that file and nothing here touches it. Which values are this box's and
can never be a project's: [settings](docs/cli/settings.md).

**Project** — everything a tracker decides for itself, in this machine's record of that project:

```
~/.config/forge/projects/<the checkout's root folder>/config.json
```

Out of the checkout and out of git, so a box can differ from the repository, a worktree can hold its
own, and setting a key is not a commit somebody has to review. The directory is named for the
**repository's** root folder — `git`'s common directory, so every linked worktree of one checkout
reads one file — and `projects/` keeps that namespace disjoint from forge's own, which grows a file
or a directory with every feature that stores something. Two checkouts whose root folders share a
name share an entry; that is the accepted cost of every worktree of one sharing one.

`forge doctor --set <key>=<value>` writes it and creates it where there is none, `forge doctor`
prints every key with the file it was read from, and a checkout still carrying a committed
`.forge.json` is told so once with `forge doctor --adopt`, which takes its contents over. Nothing
reads that file: a fallback layer is the precedence rule this shape exists to remove.

**This repository carries none**, so a box that has never configured it starts from nothing rather
than from an adoption: `forge doctor --set slug=forge-plugin` creates the record, and `forge doctor
undecided` then lists what is still unset. Which of the keys a project sets is its own decision and
never one a clone inherits — which is the point, since a key that travelled in the tree could not
differ between two boxes or two worktrees and could not be set without a commit somebody reviews.
The keys, each shown at a value some other project might hold rather than at this one's:

```json
{
  "slug": "sid-growth",
  "translate": "vi",
  "runs": 2,
  "deps": { "marker": "those edges are recorded", "blockedBy": "blocked by", "blocks": "blocks" },
  "codex": { "pathRe": "^(plugin|packages)/(src|hooks|scripts)/.*\\.mjs$|^docs/.*\\.md$", "check": "npm test", "checkMs": 600000 },
  "stop": { "agents": ["runner", "reviewer", "triage", "evaluator"] },
  "jobs": { "ba": { "verbs": ["issue", "new", "comment"], "skills": ["forge"] } },
  "rank": { "agePerDay": 2, "kind": { "bug": 20 } },
  "review": { "lines": 1500, "paths": ["plugin/src", "plugin/hooks", "plugin/bin"] },
  "feedback": { "plugin": "bugs", "project": "all" },
  "flow": "default",
  "drainedBy": "dispatcher",
  "landing": "after-merge",
  "lease": { "workingRe": "^(\\S*(sh|bash) -c )?\\S*node( -\\S+)* \\S*tools/run\\.mjs (ship|land|land-ready)( |$)" },
  "stats": { "commands": { "gate": "npm run check" } }
}
```

`slug` is read from that file alone and is demanded only by a call that needs a project id; it is
a value **inside** the file and never what finds it, so a checkout in a folder named for a branch or
a client still reports its tracker slug correctly.
`translate` is off unless set — a wrong-language issue cannot be withdrawn. `deps` is optional
and defaults to the English sentence shown. `codex.pathRe` decides which of a turn's writes are
worth a second opinion, and belongs here rather than in the account's config: a docs tree and a
code tree do not want the same answer. `forge codex show` names which of the three levels
answered. `codex.check` is the one command the reviewer may run for itself, and `codex.checkMs` is
the clock it runs under, in milliseconds; absent, that clock is 300000, and a value that is not a
whole number above zero is reported by `forge doctor` rather than taken. A check stopped at the
clock costs the consult a tool call and returns nothing, so the two are read together: `forge
doctor` prints the command with the budget in force, and says how often this machine's consult log
recorded that same command stopped at or above it. Set the clock below the one a whole consult runs
under — `forge codex show` prints that too — because a check reaching a clock past it takes the
consult with it instead of coming back as a call that was stopped. `stop.agents` names the subagents whose stop the stop gate judges, bare or with their
plugin's prefix; absent, no subagent's stop is judged, and the main agent's is judged regardless. A
plugin's hooks reach every session on the machine, so which delegated agents answer to this one is
the project's to say, and this repository names the four roles its dispatch sets up.

`runs` is how many runs this project carries at once, whoever dispatched them, and absent it
resolves to no number at all — every reader then behaves as it did before the key existed, which is
a box with more work on it than it can hold starving itself. It is one number rather than two keys
because it bounds one thing, the work this checkout has taken on: both whether a gate of this
checkout is admitted and how many test workers an admitted one gets are read off it. What this
repository's own gate does with it: `node tools/gates.mjs -h`.

Each key below is read from one place and nowhere else. `jobs` names the jobs this project has, a
job being a name and the verbs and skills its usage list offers; absent, nothing is withheld.
`rank` moves the weights `forge next` orders on, one weight at a time, the rest staying at the
built-in table. `review.lines` is how many changed lines earn a reading of what has landed and
`review.paths` is which paths of this repository are counted towards it, each relative to its root;
absent, the number and the three paths this plugin ships with stand, and those three are this
plugin's own source layout rather than a claim about anybody else's. A project that sets neither is
one `forge doctor` says nothing about: the count runs from `refs/forge/reviewed` in that project's
own repository, which the project plants and moves itself, so two checkouts on one machine never
read each other's. A project that sets one of them and whose counted paths its repository does not
hold is told so rather than counted at zero, because a trigger configured and never firing is worse
than one refused where it is read; a `review.paths` that is present and is not a list of paths
inside the repository is refused for the same reason, never quietly taking the shipped three. `feedback` says which channel each of the two feedback
kinds takes, and each of them defaults on its own. `flow` names which of the served method sets
this project runs, and `method` is retired: with no `flow` beside it, the one value that key ever
took resolves to the default set and any other is refused with the route off the key. `drainedBy` says which master claims this project's issues once they are developed. `landing`
says where the merge sits relative to the judging. `stats.commands` is what this checkout calls its
own gate, test, ship and cleanup, which is what lets a run profile a project that is not this one.
It is also what arms a door: a hook that **refuses** at one of the doors `codex.owed` names is
handed the commands this project declared and no built-in table, because a table of one
repository's commands reached from a route that denies is a refusal in every tree that spells its
gate some other way. So a door named with no command declared for it guards nothing, an empty
string, a number and an empty list each declaring nothing, and `forge doctor` prints which named
door is unarmed, what was written where a value is no command, and the key that arms it. A reading
keeps the fallback: `forge stats` counts this repository's own spellings where a project declared
none, a miscounted row in a profile costing what a refused command does not.

`lease.workingRe` is what a run working in one of this project's trees is running. The id a lease
records names the tree a run was cut in and not the run, so two agents standing in one tree resolve
it alike and the field cannot tell the second from the first renewing; the one thing left readable
is what is running in that tree, and a claim that would otherwise read the tree's own lease as its
own is refused while a process matching this pattern stands there **and is none of this call's own
work** — a match in the call's own ancestry is the release that started it, and a call that cannot
place itself against the process separating one agent's calls from another's reads nothing at all.
Neither limit is a guess; both are
[what the reading can and cannot prove](docs/cli/the-dead-holder.md). Which command that is cannot be
stated without naming the project — here it is the script that pushes and releases — so **absent,
no process in a tree reads as a run working there and every claim is decided by the record alone**,
which is how the plugin behaved before the key existed. Declare the commands that would cost
something to run twice, not the gate: a run starts its own gate before it claims, and a pattern
matching that refuses the run its own issue. A pattern that is not a regular expression is reported
by `forge doctor` and read as no declaration at all.

The project **id** is never configured — it is looked up from the slug at runtime.

`forge doctor` prints every one of these, says which source answered, and reaches the endpoint.
Run it first when anything refuses. **It also writes them**, one at a time and into this same file:
`forge doctor --set review.paths=plugin/src,docs`, `forge doctor --set codex.checkMs=600000`,
`forge doctor --set jobs.ba.skills=forge`. The value is judged by the reader that reads that key
before anything is written, only the key named is touched, and `forge doctor --set` with a key this
plugin reads nowhere lists what the file holds. `flow` is `forge doctor --flow <slug>`'s, which writes
it with everything that flow asks for. Why the keys are declared rather than discovered and what a
write may not do to the rest of the file: [the project's own file](docs/cli/the-project-file.md).

### What else lives in `~/.config/forge/`

`~/.config/forge/config.json` also holds two keys `doctor` writes and the rest of the CLI reads:

- **`capabilities`** — per project, which tools refused this credential and when. The usage list
  withholds every verb that spends one recorded here, so **a verb can be missing from `forge -h`
  because of this file.** `forge doctor` prints what it measured, refusals included, and is never
  itself withheld — the verb that re-probes a credential cannot be gated on it.
- **`withheld`** — the verbs this machine does not offer, each under the state it is in. `hidden`,
  what `forge doctor --hide <verb>` writes, is unlisted and still runs when typed; `off`, what
  `forge doctor --job <name>` writes for every verb outside the job, is unlisted and refused
  whichever route the call comes in on. A verb no entry names is offered and served.
  `forge doctor --show <verb>` puts one back. Releases before the states wrote a bare list of names
  here and it still reads, every name in it hidden; the states are written over it the first time
  one of those flags writes. A `forge` older than the states cannot read what they write — delete
  the key to put such a copy back on its feet.

`tools-<hash>.json` beside it caches the server's 130 KB tool declaration, keyed by endpoint. It is
refreshed when a name lookup misses and on every `forge doctor` run; deleting it costs one slow
call, never a wrong answer.

`vi-natural` keeps its own key at `~/.config/vi-natural/config.json` (`vi-natural login --key`).

One environment variable belongs to the checks rather than to the CLI. `KEEP_TEST_ROOMS=1` tells the
gate run, and every suite fixture underneath it, to hold on to the scratch directory it would
otherwise delete on its way out, and to print on standard error where it left it. Nothing reaps one
afterwards — that is what asking buys — so it is set for the one run you mean to read, never kept.

## Layout

```
.claude-plugin/marketplace.json   the local marketplace, name: forge-local
plugin/
  .claude-plugin/plugin.json      the plugin manifest, name: forge
  bin/forge  bin/vi-natural       PATH entry points; reached through the link, they dispatch
  guides/contract/<flow>/         the contract a status is earned under, one file per part, and the
                                  whole of what that flow serves
  guides/skills/<skill>/<flow>/   each skill's served method as `guide/`, one file per part, beside
                                  its `references/` — the whole of what that flow serves
  src/                            the forge CLI
    cli.mjs          argv, the usage list, the write-time rules
    dispatch.mjs     which copy a call through the PATH link runs
    commands.mjs     one function per verb
    suggest.mjs      the near miss every refusal offers
    flow/            the lease, the typed records, what each status is earned by
    tracker/         paging, the browse projection, ISS-45 -> uuid, the retry
                     ladder over one wire/ attempt, the cached tool surface, the
                     write boundary, and the contract above cut at its headings
    codex/           the consult, its tools, its log and what it owes
    checks/          what this tree holds its own documents and code to
    hooks/           the refusal log and the per-hook switch, shared with hooks/
    wire/            what one outbound attempt is made of: the clock it runs
                     under, the REST origin beside an MCP endpoint, and how an
                     event stream is read off it
    tools/           vi-natural, doctor, which copy is running
      services/      the verbs answering from somebody else's service on this
                     machine's own credentials — cloudflare, coolify, chatgpt —
                     and the doctor lines reporting those credentials
    spec/            the requirements tree, answered by identifier
    stats/           where an issue-flow run's time and rounds go, off the transcripts
    resolve/         what this run is: settings to { value, from }, ~/.config/forge
                     at 0600, the flag parser, and the verb table deciding what
                     this credential may see
  hooks/
    _hook.mjs             the event, the files a call wrote, deny/block, the once-per-session stamp
    link-cli.mjs          SessionStart: both binaries onto PATH, and each skill's stub written
                          for the tools this machine has configured
    entries/              one registered line each, running one gate alone
      bash-guard.mjs        PreToolUse: the shell commands that cannot be undone, and the wait that polls
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
  skills/<name>/SKILL.md  what every invocation of a skill reads: rules and a route table, or a stub
  guides/skills/<name>/<flow>/  what a minority of invocations reads, served by `forge guide <name>`
  skills/audit-code-quality  skills/setup-code-quality  whole, shared with packages/code-quality
  agents/<role>.md        one role a dispatch names instead of typing a model beside a general agent
```

An import may run from `vi-natural/` into `src/` and never the other way. The two directories are
one shipped unit — the PATH link already runs that CLI through `src/dispatch.mjs`, so `src/` is
loaded on the ordinary route into it — and `src/` is this plugin's library, which is what a second
consumer is meant to take from. What `vendor/` answers to is a different constraint: it reaches
*out* of the plugin directory to `packages/`, and a copy is the price of travelling alone. A path
inside `plugin/` pays nothing. The reverse direction is what the subprocess is for —
`src/tools/vi.mjs` spawns `bin/vi-natural` rather than importing it, because that CLI's entry point
is an entry point. So a primitive both trees need lands in `src/`, in a module that imports
nothing, and `vi-natural` spends it.

What would reverse this: `vi-natural` shipping on its own, outside this plugin directory. Then the
constants it borrowed come back as its own named declarations, one per tree, and the guard that
watches for a second copy re-narrows to `src/` and `hooks/`. Nothing else here has to move, which
is the point of keeping the borrowing to values that carry no graph behind them.

## Where a skill's text goes

Text goes where it costs the fewest rounds for the reading that most often needs it. Needed by every
invocation: inline in `SKILL.md`, under the byte ceiling `plugin/test/guides/skill-guides.test.mjs`
states. Needed by every run of a long method: the body `forge guide <skill>` serves, one call. Needed
by a minority of invocations: a reference, cited from the exact point. Answered by a tool's own `-h`:
nowhere in the skill, which names the verb instead. A skill sentence is a rule, a route or a trigger;
the reason behind one lives in `docs/`, and a measurement on the issue that took it, which
`check:skill-figures` holds.

A role's own text answers to the same rule for a sharper reason: a definition is written once and
read on every wave, so anything true of one dispatch — a tree, an issue, a set of held files —
belongs in the message and never in the file. What the roles are for and why the definitions stay
this thin: [`docs/dispatch-and-roles.md`](docs/dispatch-and-roles.md).

## Two levels

This plugin is the **global** level. It owns *when and where* a rule fires — which tool routes are
watched, which directories are in scope. It owns no rule about what good code is.

A **project** owns that. Its eslint config, its thresholds, its gates. Which level a rule belongs
to, and what happens where both could speak, is stated once in [`docs/two-levels.md`](docs/two-levels.md).

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
