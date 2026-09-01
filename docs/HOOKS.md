# The hooks: what fires where, and where the reasoning is

This states what every gate here shares — the two levels, the one switch, the log. Why an
individual gate refuses what it refuses is its own document, next to the code, one per hook:
`plugin/hooks/why/`. `plugin/hooks/hooks.json` is the wiring.

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
## A refusal is short, and says where the argument is

What a hook prints lands in a context window on every tool use, so a refusal carries only the
shape it refused and the one action that clears it. The argument for the rule — the failure it was
written for, the measurement behind a threshold, the case that was tried and removed — is one
command away, and the refusal ends with that command:

    forge hooks --why <hook>

It reads `plugin/hooks/why/<hook>.md`, which is the list: one file per gate that has a reason to
give, and `forge hooks --why` with a name it does not hold answers with the nearest one it does.

The reasoning ships inside the plugin rather than in `docs/`, because only `plugin/` travels into an
installed copy. A refusal citing a path under `docs/` would name a file that does not exist in the
project the gate fired in, which is the one thing a pointer may not do.

## Writing the two of them

The refusal and the document are one contract with two halves, and each has a shape that has already
been got wrong here. The messages are literals in their hook, never loaded from a file: a rule is
stated once, in the checker, and the wording belongs beside the decision that produces it.

**A refusal: what was refused, the rule in one clause, one action, the pointer.** Nothing else.

    WRONG                                     RIGHT

    Hold — this writes to project memory,      Hold — `a-new-fact.md`, a new memory. Why
    and project memory is knowledge the        should it exist, and will it still matter
    project inherits, so it has to be worth    later?
    inheriting. The four conditions are
    that it cost a cycle, will recur, fails    Record only what cost a cycle, will recur,
    silently, and is not already written.      fails silently, and is not already written.
    Most rounds record nothing. The            Most rounds record nothing.
    categories are user, feedback, project
    and reference, and each of them lands      Do this: if a memory already states this,
    somewhere different …                      fix that file. Otherwise re-send.

    [864 characters, on every write]           Why: `forge hooks --why learning-gate`
                                               [434 characters]

Four failures worth naming, every one of them found by firing a gate rather than reading it:

- **A pointer that is a path.** An absolute path to a reference document, printed for the first
  refusal of a session only, was long on the first refusal and absent on the second. The verb costs
  one line and is always there.
- **A name that cannot exist.** A variable holding a command substitution, expanded into the message,
  named a file after the command. Name what the message can defend — the basename will do.
- **A tool redirect instead of a rule.** "Use the Write tool instead" teaches nothing about whether
  the fact belonged in a file at all. State the rule, then the action.
- **A rephrasing offered as the way out.** A refusal that invites rewording until the pattern misses
  teaches that the gate is noise, which costs every refusal after it. Say the safer form, and treat a
  wrong refusal as a case for the user rather than a thing to slip past.

**A document: the argument the message could not afford.** Under 2,600 characters — about 650 tokens
when an agent reads it, which is the cost the pointer exists to avoid, and short enough that someone
reads all of it. `# <hook> — <claim>` as its first line, so `forge hooks --why` opens with what the
gate is *for*. One claim per paragraph: that is the discipline that fits ten gates into the ceiling,
and the paragraph that carries no claim of its own is the one to cut.

    WRONG                                     RIGHT

    The gate refuses a memory write until      The failure this guards is not a bad memory
    the category is named. It also handles     row — it is the reflex one. An agent that
    skills. Originally it only checked the     finishes a task reaches for "save what I
    shape, then we added the duplicate         learned" as a closing ritual, and the
    check, and later the shell route.          corpus fills with entries nobody reads.

    — restates the message, then narrates      Calibrated on six real memories: five score
      a changelog                              0.00, the one related pair 0.27, a
                                               paraphrase re-filed under a new name 1.00.

                                               The cost is real: a program that quotes a
                                               guarded path is refused even when the path
                                               is prose — which caught the very commit
                                               documenting this.

So: the failure it was written for, the measurement behind any threshold, the alternative that was
tried and removed, the price being paid on purpose, and what it deliberately does not judge. History
earns its place when it explains why the current shape is what it is — "stripping every quoted span
cost one real bypass" is the argument for the current rule; "then we added X" is a changelog, and
`git log` already holds it.

Two constraints the checker enforces, both learned the hard way: no absolute path and nothing under
`docs/`, because only `plugin/` travels into an installed copy; and a document either names a hook
that prints the pointer, or is a shared topic the harness itself cites — `writes` is one, since two
gates read a write the same way and that argument should live in one place.

## Every hook can be switched off, one at a time

Claude Code has no per-hook toggle. `skillOverrides` in settings does not reach a plugin's skills —
the documentation sends you to `/plugin`, which takes a whole plugin — and the only hook switch is
`disableAllHooks`, which takes the whole arrangement. Measured against the 2.1.251 bundle: no
`disabledSkills`, no `CLAUDE_CODE_DISABLE_HOOKS`, no per-hook field in the `hooks.json` schema.

So the switch is this plugin's own, and there is exactly one of it: `hooksOff` in
`~/.config/forge/config.json`, holding hook names. `forge hooks --off <hook>` / `--on <hook>` writes
it, and `forge hooks` and `forge doctor` print which gates it holds down, each with the command that
clears it.

**One source, because two would be a rule to remember.** An environment variable beside the config
means a precedence rule, a report that has to say which layer holds a gate, and an undo in two parts
that is wrong whenever only one part applies — a gate someone believes they turned back on is the
worst state this switch can be in. A test asserts that nothing in the environment reaches the
decision, and it reads the module rather than trying variable names — the name a later layer would
pick is exactly what a test sampling names cannot know.

The wider switches a gate carries of its own stay, because each is its own decision rather than a
second answer for one hook: `FORGE_CODEX_DISABLE=1` takes every codex gate at once,
`CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` the two that order the advisor. `forge doctor` reports those as
gates that are down too, with `unset` as the undo, and reads the pairs out of the hooks — otherwise
it would print `forge hooks --on <hook>` for a gate that variable keeps down whatever the config
says, which is the same lie in a different layer.

**One name is one hook type.** Every script here is registered on exactly one event, so switching
`codex-turn` switches PostToolUse and nothing else — which is why the answers name the event. That
holds because a test derives the registrations from `hooks.json` and fails on a script registered
twice, whose name would stand down two events while mentioning neither. The day one appears, the key
gains a `name:Event` form; until then it would be a shape with no case behind it.

**It costs nothing measured.** A hook is ~47 ms of Node startup, and the switch is inside the
noise: one read of a small JSON file, memoized per process, before anything else runs.

**The hook process reads it, not the registration.** `hooks.json` is read once at session start and
hook code on every event, so a config the hook reads is the only switch that takes effect without a
restart — and a hook is one process per event, so there is no cache to go stale.

**It fails open.** A config that will not parse, or a `hooksOff` that is a string rather than a
list, runs every gate: the cost of a broken switch has to be a gate firing, never a gate silently
gone. The check lives inside `readEvent`, which every hook calls before it decides anything, so no
hook can forget it. `link-cli` reads no event and names its own switch instead — it is in the list
because the names are derived from the directory, and a name that switched nothing would be a lie
of exactly the shape a checker matching nothing is.

A name matching no hook file is a finding, not a silence: after a rename, `hooksOff` would read as
an arrangement someone turned off deliberately, so `forge doctor` reports it as a miss.

Scoping a switch to one project is not built — `hooksOff` is the account's, like the withheld verbs
it mirrors.

## Every refusal is written down

A gate that refuses too much is the failure mode here, and for months nothing recorded a refusal:
three false positives in one session were all found by watching a command fail. `deny()` and
`block()` append to `~/.config/forge/hook-log.jsonl` themselves — the event comes from a stash
`readEvent()` fills, so no hook passes anything and the gates that predate the log are covered too.
`forge hooks --deny` reads it back with a count per hook. Credentials are masked and the line is cut
at 220 characters before anything is written: `docs/FORGE-CLI.md` says which shapes and why.

## A claim in a project's own CLAUDE.md is checked where it is written

`forge doctor` has checked those claims for a while, and doctor is run when someone already suspects
something. `claude-md` moves the same function to the write: `PostToolUse`, beside `code-quality`,
both answering for bytes a call has just put on disk. The baseline is the committed file, so a
repository that was inherited wrong still gets the edit that fixes it — a gate that fires over
someone else's sentence is a gate that gets switched off. `forge hooks --why claude-md` carries the
rest, including what it deliberately does not judge.
