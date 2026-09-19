# CLAUDE.md

**forge-plugin** — the Claude Code plugin for the Forge tracker: a CLI, the hooks that guard a
session, and the skills that drive both.

**Three goals rank above the rest of this file.** Where two shapes are both defensible and only one
can ship, the first of these that reaches the decision settles it: `G-11`, time and the person out
of the loop; `G-12`, configuration rather than a special case; `G-13`, the cause and everything it
reaches. A filing or a decision cites one of them the way it cites the goals standing behind them.
Every goal this project holds, live or retired, has its clause in
[`docs/requirements/brd/03-goals-non-goals.md`](docs/requirements/brd/03-goals-non-goals.md) and
nowhere else: `forge spec G-11` prints one, `forge doctor` prints which are live.

**Rules only.** Facts live in the code, mechanics in each tool's `-h`, history in `git`. A rule with
a checker is stated once — in the checker, whose message is what a developer reads when it fires.
Every `.md` here obeys the same division: it carries what the code cannot — the decision behind a
shape, the constraint, the route out — and never restates or explains code. A paragraph narrating an
implementation is a second copy that goes stale without failing anything.
Nothing here names a path or a script that does not resolve; `forge doctor` checks that. Install,
configuration, layout and which level a rule belongs to: [`README.md`](README.md). The CLI's
surface, one row per topic and the topic in its own file: [`docs/FORGE-CLI.md`](docs/FORGE-CLI.md). What the hooks share:
[`docs/HOOKS.md`](docs/HOOKS.md). What this plugin owes, one clause per identifier so an issue can
cite it: [`docs/requirements/README.md`](docs/requirements/README.md), which also carries that
tree's own rules. A refusal carries the one command that clears it, because an agent
that needs a second call to learn what to do spends the turn guessing; `forge hooks --how <hook>`
carries what a refusal has no room for — why the rule exists, what it does not judge, the escape.
Every input a verb or a typed write is given is used or refused, never ignored: a flag read and
dropped, a field written and not read back, a duplicate silently taking the last value, all read to
the caller exactly like the thing they asked for happening.

## An entry point is not a library

A registered hook and a script under `plugin/scripts/` are entry points, and nothing imports an
entry point. Code a second one needs moves to `plugin/src/` before the second copy exists — nothing
checks the direction, and one script reaching into another is how it starts. Three exceptions are
imported and are not entry points: `plugin/hooks/_hook.mjs`, the harness every hook loads;
`plugin/hooks/gates/`, the gates themselves, which `plugin/hooks/gate.mjs` runs together per event and
each entry under `plugin/hooks/entries/` runs alone for the suite and the hand; and
`plugin/hooks/vendor/`, copies of `packages/code-quality/` — a plugin directory travels alone and cannot import a sibling package.
README says why.

## This code runs in repositories you cannot see

A hook fires in whatever project has the plugin installed, on a tree with its own gates, its own
default branch and its own idea of good code. So it may refuse a *shape* and never a style, it reads
configuration rather than assuming it, and it stays silent where a project has not decided. The
division and the case where both levels could speak:
[`docs/two-levels.md`](docs/two-levels.md).

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

## Nothing a run touches is the developer's own

The property, not the variable: a run reads and writes state of its own, never the state of the
person whose machine it is. `~/.config/forge/` holds a working token and the consult log,
`~/.claude/` the gateway profile and the install record, `~/.local/bin` the links a session start
writes — and a run pointed only at the one of those that was known to leak still has the rest. Every
home-rooted path is therefore read where it is used, so a home the caller sets reaches it, and the
suite's own fixture is what hands a run that home.

## The steps around a change are the repository's

Where a delegated run works, and what puts its commit in the plugin copy the next session loads, are
one script: `node tools/run.mjs -h`. A prompt that carries them instead is a second copy of a
procedure, read by one session, with nothing to fail when it goes stale.

## Verifying

Run `npm run check`. It is scoped and it remembers, so re-running the whole thing after a fix is
what you do rather than something to avoid. That trades one danger for another: a step whose
declared paths are too narrow is never red, it is absent. So a step is added to the table with the
paths it read off its own script, a claim every run holds it to by watching the step read, and
`--full` is how a run distrusts the record. `node tools/gates.mjs -h` carries the rest.

Fix the source, never the gate. A real violation that passes means the checker is wrong, and it gets
fixed in the same task rather than exempted.

A checker is only proven by watching it fire, so a new rule ships with a case that fails without it
— and one reading of that red is not the proof. A case whose outcome turns on what ran before it
fails one way and passes the other, and neither reading can be told from the other by itself, which
is how a case that could never have failed gets accepted as the proof of a rule. Watch the red with
`node tools/red.mjs`, which takes both readings and says what they are worth.
