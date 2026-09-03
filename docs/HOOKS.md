# The hooks — what they share, and how to write one's message

What is true of every gate here. One gate's own document is `forge hooks --how <hook>`, the wiring is
`plugin/hooks/hooks.json`, and the global/project division has its own reference in the issue-flow
skill.

## Which files a call wrote

The file hooks watched `Write`, `Edit` and `MultiEdit` and nothing else, so every edit made through the
shell passed all of them unseen — under a permission mode that encourages Bash, the main road rather
than an edge case. What counts as a write is one document — `forge hooks --how writes` — because six
gates decide by it, and a second account here would diverge the first time one of them was corrected.

## Writing a refusal, and the document behind it

Both are literals in their hook, never loaded from a file: the wording belongs beside the decision
that produces it, and a message assembled somewhere else drifts from what the code actually refused.

**A refusal:** what was refused, the rule in one clause, one action, then `How: forge hooks --how
<hook>`. Nothing else — it lands in a context window on every tool use. The learning-gate message was
864 characters of conditions and categories; it is 434 now, and the conditions it kept are the test the
agent has to apply before re-sending.

Four failures worth naming, every one found by firing a gate rather than reading it:

- **A pointer that is a path.** An absolute path printed on a session's first refusal only was long
  once and absent afterwards. The verb costs one line and is always there.
- **A name that cannot exist.** A variable holding a command substitution, expanded into the message,
  named a file after the command. Name what the message can defend — the basename will do.
- **A tool redirect instead of a rule.** "Use the Write tool instead" teaches nothing about whether the
  fact belonged in a file at all.
- **A rephrasing offered as the way out.** The gate then reads as optional, and every refusal after it
  is ignored on principle. Name the safer form.

**The document: how to do the thing right.** An agent opens it having just been refused and wants the
route out, so the argument is capped and the rest is instruction:

    WRONG                                      RIGHT

    The gate refuses a write when the file      Why: a token in a repository file is one
    looks like it holds a secret. It also       push from public, and nothing about it
    handles env files. First it matched         fails loudly.
    prefixes, then we added entropy
    scoring, and later the shell route.         How to clear it: keep the value in the
    Tuned on nine files in this tree …          account config and name the key here.
                                                Asked once per file.
    — restates the message, narrates a
      changelog, and leaves the agent           How to work through it: a fixture may
      exactly where it was                      carry an obviously fake token.

                                                Not judged: whether the value is live.

The shape, four rules of it enforced by the suite:

- `# <hook> — <claim>`, so the verb opens with what the gate is for.
- `Why: …` as the second paragraph, at most 280 characters — 65 tokens. One failure or one measurement.
- How to clear it, and how to work through it: what to re-send, what counts as an answer, how often it
  asks, and what to do with a refusal you believe is wrong.
- `Not judged: …` on its own line, so nobody over-complies with a gate that was never asking.
- Under 1,300 characters all in; the ten average 928.
- No absolute path, nothing under `docs/`, and nothing that restates or explains code — only `plugin/`
  travels into an installed copy, and mechanics belong to `-h` and to the source.

**One gate may owe two arguments.** A gate that refuses two unrelated things cannot argue both
inside that ceiling, and the ceiling is the rule that keeps these readable. So the second argument
gets a page of its own, named for the topic rather than the hook, cited from the gate that prints
the pointer and reached by the same `--how`. The switch stays the gate's: turning it off takes both
refusals with it, and the page says so.

Cut arguments freely and check every instruction against the code: one pass of that cutting shipped
five wrong or missing claims — a lost `/dev/` exclusion, a stand-down described as something else, two
harms collapsed into one sentence — and a diff review caught all five.

## One process per event

Ten registered scripts cost ten Node starts per tool call — 46 to 67 ms each, 38 of it Node itself —
with three of them reading the transcript tail apart and five computing the touched files apart. So
`hooks.json` registers one line per event, `gate.mjs` with the gates named in order, and the gates run
in one process against one event, sharing those reads. Before a call the first refusal is the answer,
as it was when each was a process; after one, every block and every context is kept and sent together,
where the old arrangement let each print its own. A gate answers by throwing a decision the runner
turns into the protocol, so the same gate text runs alone under `plugin/hooks/entries/<name>.mjs` for the suite
and for `forge hooks --off <name>`, which reads the names off the line.

One gate asks the tracker before it can answer, and a call it cannot make ends the process with its
own reason on stderr. That is a stand-down and not a failure: the write it guards travels on the
transport that just failed, so there is nothing left to guard. It is therefore registered last on
its line, where no gate after it is lost to that exit, and a case asserts the order — a rule that
lived in a comment asking the next author to be careful would be no rule.

Those solo lines sit in `entries/` rather than beside the runner because one directory holding the
harness, the runner and a line per gate is a list and not a shape — the width check says so at eleven
files. `link-cli.mjs` stays beside the runner: it is no gate, it has no text under `gates/`, and a
person is told to run it by that path after a fresh install. The switchable names are therefore read
off both directories, which is why nothing keeps a list of them.

## Every hook can be switched off, one at a time

Claude Code has no per-hook toggle. Measured against the 2.1.251 bundle: `skillOverrides` does not
reach a plugin's skills, `disableAllHooks` takes the whole arrangement, and there is no
`CLAUDE_CODE_DISABLE_HOOKS` and no per-hook field in the `hooks.json` schema. So the switch is this
plugin's own: `hooksOff` in `~/.config/forge/config.json`, written by `forge hooks --off <hook>`.

**One source, because two would be a rule to remember.** An environment variable beside the config
means a precedence rule, a report that has to say which layer holds a gate, and an undo in two parts
that is wrong whenever only one applies — a gate someone believes they turned back on is the worst
state this switch can be in. The wider switches a gate carries of its own stay, because each is its own
decision rather than a second answer for one hook, and `forge doctor` reports those as down too with
`unset` as the undo.

**It fails open.** A config that will not parse runs every gate: the cost of a broken switch has to be
a gate firing, never a gate silently gone. **It costs nothing measured** — a hook is ~47 ms of Node
startup, and one memoized read of a small file is inside that noise. **And the hook process reads it**,
not the registration, so a switch takes effect without a restart.

Scoping a switch to one project is not built: `hooksOff` is the account's, like the withheld verbs it
mirrors.

## Every refusal is written down

A gate that refuses too much is the failure mode here, and for months nothing recorded a refusal: three
false positives in one session were all found by watching a command fail. Refusing is now what writes
the line, so no gate can opt in or forget — including the two written before the log existed. Which
shapes are masked first, and why: `docs/FORGE-CLI.md`.

## A claim in a project's own CLAUDE.md is checked where it is written

`forge doctor` has checked those claims for a while, and doctor is run when someone already suspects
something. `claude-md` moves the same check to the write, beside `code-quality`, both answering for
bytes a call has just put on disk. The baseline is the committed file, so a repository inherited wrong
still gets the edit that fixes it — a gate that fires over someone else's sentence gets switched off.
