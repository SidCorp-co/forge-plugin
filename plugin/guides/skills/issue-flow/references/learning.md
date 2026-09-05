# Learning selectively

**Most rounds should record nothing.** A workflow that writes a lesson after every issue
produces a corpus nobody reads, and the few entries that mattered are buried in it. The
default at the end of a round is silence.

## What the gate asks, and what it cannot

The conditions a record has to meet, the categories a skill edit is typed by, and how to write
through the refusal are the learning gate's own text, printed at the write it stops:
`forge hooks --how learning-gate`. Where project knowledge goes and what an entry owes is the store
verb's: `forge knowledge -h`, and `forge schema forge_knowledge` for the values it classifies by.
The rest of this file is what neither of them can ask about — what a round *removes*, and what
happens when the method itself was the thing that was wrong.

**Type the gap where you met it, before deciding what it earns** — a phase with no branch for what
happened, a reference that sent the run the wrong way, a rule that contradicted the tracker's own —
so that the conditions are judged against what was typed rather than what is remembered. The record
has a kind for it, and for the run that met none. A closing message written from memory keeps the
workaround and loses the gap that forced it.

## Where a skill learning lands, once it has earned a place

**Into the plugin's code**, wherever the wrong state has a *shape*: a command matching a pattern, a
field absent, a file missing, an ordering violated. It is the only destination that cannot be
missed — prose is read by an agent that decided to read it; a check fires whether or not anyone
remembered. If it has no shape, **into the skill's own text, in the place that category belongs**
and never appended to a general pile: a learning that survives lands in the reference for its
category and not in `SKILL.md`, whose spine changes only when a rule changes or a phase's shape was
wrong. A sentence that ends up in both is a correction waiting to be missed in one of them. And
third, **nowhere**, which is still the most common answer.

One category *subtracts*, and it is the easiest to miss: a rule that turns out to have been one
project's convention is deleted rather than softened, and the change says what replaced it.

Writing a skill learning into project memory is the common mistake, and it loses the lesson twice:
the project inherits a rule it never agreed to, and the skill repeats the mistake in the next
repository.

## The second occurrence is the promotion trigger

A trap that fires twice while still living in prose is evidence the prose does not work. The
second occurrence is not a reason to word the sentence more firmly — it is the trigger to
move it into code. If it cannot be made into a check, say why in the same change, because
"this cannot be automated" is itself worth knowing.

## Pruning is half of learning

A skill only grows unless something removes from it, and a stale rule is read and obeyed.
Three things earn deletion:

- **A rule the plugin now enforces** — deleted from prose the day the check lands. Two
  authorities for one rule is how they diverge, and this plugin measures the overlap between
  two statements of one rule rather than leaving it to a reading.
- **A rule the tool now documents itself.** Anything a `-h`, a schema or an error message
  says is no longer the skill's to repeat.
- **A rule whose reason expired** — the bug was fixed upstream, the convention changed.

When a round records something, spend the same breath asking what it displaces. A skill that
only accumulates stops being read, and a skill that is not read enforces nothing.

## Changing the workflow itself

A phase skipped three times is evidence about the phase, not about the sessions that skipped
it. Record the pattern first and change the phase once it has recurred — a workflow
rewritten from a single bad round is fitted to that round. Then read
`forge guide issue-flow prior-art`, which says what the current shape already considered and turned
down.

## Where a rule goes, and why a hook is the last place

Push a rule as far down this list as it will go; one that sits higher than it needs to is
maintenance nobody asked for.

1. **A type.** Fires at compile, costs nothing to keep. A handler taking `string` where the
   value is one of a closed set lets a typo become a branch that silently never runs.
2. **A checker the gate runs.** Sees the whole tree, may be slow and thorough, and is the
   authority on its own rule — a hook that reimplements one has created the second definition,
   and the second definition is the one that drifts. What it must not do is enumerate by hand
   the cases it could have derived: `forge hooks --how derive-dont-list`.
3. **A hook.** One tool call, tight timeout, near-zero tolerance for noise. Reserved for what
   a checker cannot see: an action that leaves no tree to scan, and a write whose *decision*
   has to happen before the file exists. A file hook matched on `Write` and `Edit` alone is
   watching the side door, and what counts as a write for every gate that asks is one
   answer, given once: `forge hooks --how writes`.
4. **Prose.** Last, because it is read only by someone who chose to read it.
