# The hooks, and why each one exists

Four hooks, and the reasoning behind them. The code states constraints; this states the
failures the constraints were written for. `plugin/hooks/hooks.json` is the wiring.

## Two levels

This plugin is the **global** level: it owns *when and where* a rule fires — which tool routes
are watched, which directories are in scope. A **project** owns *what counts as correct*: its
ESLint config, its thresholds, its gates. Which level a rule belongs to, and what happens
where both could speak, is stated once in
`plugin/skills/issue-flow/references/two-levels.md`.

## Which files a call wrote — `_hook.mjs`

The file hooks watched `Write`, `Edit` and `MultiEdit` and nothing else, so every edit made
through the shell — `sed -i`, a heredoc, a one-liner that opens a path — passed all of them
unseen. Under a permission mode that encourages Bash that is not an edge case; it is the main
road.

Parsing the shell command is the wrong tool, because there is no bounded set of ways to write
a file. So the hook asks the disk instead: any path-shaped token in the command that names a
real file whose mtime is within the last breath is a file this call just wrote. That covers
`sed`, a heredoc, `tee`, `cp` and a script that opens a path it mentions, without any of them
being understood.

## `code-quality.mjs` — the plugin fires, the project decides

`eslint-plugin-code-quality` ships its own Claude plugin whose hook script resolves the
consumer project's workspace, ESLint binary and config. Reimplementing that here would be a
second copy of something already maintained, so this hook forwards to it instead — preferring
the project's own copy in `node_modules`, falling back to `hooks/vendor/` for a project that
never installed the package. A project with no ESLint stays silent either way; the script
treats that as an opt-out rather than a misconfiguration.

The gap that justifies a wrapper is routes, not rules: the shipped hook's matcher is
`Edit|Write|MultiEdit|NotebookEdit`, so the shell route was unwatched.

The vendored copy is a copy on purpose — that script is built to travel alone into a plugin
cache, and its own header says so. `plugin/scripts/check-vendor.mjs` compares it against
upstream when upstream is on this machine, and reports which commit it is pinned at when it
is not. It compares code rather than commit ids: upstream moving without touching that file
is not drift.

`hooks/vendor/text-overlap.js` is here for the same reason and read by a different caller:
`plugin/scripts/skill-dup.mjs`, so the duplicate-text measurement the `no-duplicate-comment`
ESLint rule uses is the one the skill audit uses. Every file in `vendor/` names its own
upstream path in its header, which is what lets the check walk the directory instead of
carrying a list of what is vendored.

The delegate runs the project's `prettier` before linting, so it **writes** the file.
Extending it to the shell route means a file written by `sed` gets formatted too — the same
contract every project already accepted on `Edit`.

## `derive-dont-list.mjs` — a checker that hard-codes its cases

A checker earns its keep by catching what nobody predicted. A list written by hand only knows
the cases its author had already met, and it fails twice over: it stays silent when someone
adds a case it never heard of, and it reports a false gap when someone extends the thing
correctly. The second failure is the expensive one — a checker that cries wolf gets switched
off, and a switched-off checker protects nothing.

Measured on a real repository: an error-code test carried a six-item list copied by hand out
of a `switch`. Adding one arm to that switch and one code to the shared contract — a correct
change, both halves consistent — made the test fail on the correct change, while a version
that derived its cases from the source stayed green.

It is a nudge, not a refusal, because a hard-coded list is sometimes the honest answer: a
ratchet's list of migrated directories is *supposed* to be enumerated, because being
incomplete is the point. A comment directly above the literal silences it outright. That is
not politeness — it is the difference between a list nobody examined and one somebody decided
on, and the decision is the only thing a reader downstream can act on.

## `learning-gate.mjs` — two writes, and they are not the same write

A memory row is *project knowledge*. An edit to a skill's own text is a *skill learning*,
which develops the method rather than the repository. Confusing them loses the lesson twice:
the project inherits a rule it never agreed to, and the skill repeats the mistake in the next
repository.

The failure this guards is not a bad memory row — it is the reflex one. An agent that
finishes a task reaches for "save what I learned" as a closing ritual, and the corpus fills
with entries nobody reads, which is how the two or three that mattered get buried.

So the gate is cheap to pass and impossible to pass absent-mindedly. The write is refused
once; the four conditions and the category list come back as the reason. A memory row passes
on a second attempt carrying `metadata.checked`, and a file edit passes on the next attempt at
the same file in the same session. Naming the category is the point — it is the one part of
the test that cannot be answered by nodding.

A memory or skill file written through the shell would pass all of that unseen, because
`sed -i` and a heredoc carry no content the gate can read, and the decision has to happen
*before* the write. So that route is closed for those two kinds of file rather than
approximated. Naming a file is not touching it: only a command carrying a write shape is
asked about, so reading a skill stays free.

## `bash-guard.mjs` — what cannot be undone

Every rule here used to be a sentence in a skill. A sentence is read by an agent that decided
to read it, and these are the cases where one missed reading costs work nobody can
reconstruct: a process the user has been running for days, or uncommitted changes with no
history to restore from.

It is deliberately narrow. A guard that refuses too much gets disabled, and a disabled guard
protects nothing — so each pattern names one command shape with a stated safer form, and
anything it cannot recognise is allowed through. The git rules only bite when the tree is
dirty, because there is nothing to lose otherwise, and any doubt counts as dirty.
