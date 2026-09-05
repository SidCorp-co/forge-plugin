# Learning selectively

**Most rounds record nothing.** The default at the end of a round is silence.

## What the gate asks

The conditions a record has to meet, the categories a skill edit is typed by, and how to write
through the refusal: `forge hooks --how learning-gate`. Where project knowledge goes and what an
entry owes: `forge knowledge -h`, and `forge schema forge_knowledge` for the values it classifies by.

**Type the gap where you met it, before deciding what it earns**: a phase with no branch for what
happened, a reference that sent the run the wrong way, a rule that contradicted the tracker's own.
`forge record gap` has a kind for it, and for the run that met none.

## Where a skill learning lands

1. **Into the plugin's code**, wherever the wrong state has a shape: a command matching a pattern, a
   field absent, a file missing, an ordering violated. A check fires whether or not anyone remembered.
2. **Into the skill's own text, in the place its category belongs**, never appended to a general
   pile: a reference for its category, or the body only when a rule or a phase's shape changed. A
   sentence in both is a correction waiting to be missed in one.
3. **Nowhere**, which is the most common answer.

A rule that turns out to have been one project's convention is deleted, and the change says what
replaced it. A skill learning never goes into project memory: the project inherits a rule it never
agreed to, and the skill repeats the mistake in the next repository.

## The second occurrence is the promotion trigger

A trap that fires twice while living in prose moves into code; the second occurrence is not a reason
to word the sentence more firmly. If it cannot be made into a check, say why in the same change.

## Pruning is half of learning

Three things earn deletion from a skill:

- a rule the plugin now enforces, deleted the day the check lands
- a rule the tool now documents itself, in a `-h`, a schema or an error message
- a rule whose reason expired

When a round records something, ask what it displaces.

## Changing the workflow itself

A phase skipped three times is evidence about the phase. Record the pattern first and change the
phase once it has recurred; a workflow rewritten from a single bad round is fitted to that round.

## Where a rule goes, and why a hook is the last place

Push a rule as far down this list as it will go:

1. **A type.** Fires at compile, costs nothing to keep.
2. **A checker the gate runs.** Sees the whole tree, and is the authority on its own rule; a hook
   that reimplements one has created the second definition. It derives its cases rather than
   listing them: `forge hooks --how derive-dont-list`.
3. **A hook.** One tool call, tight timeout, near-zero tolerance for noise. Reserved for an action
   that leaves no tree to scan, and a write whose decision has to happen before the file exists.
   What counts as a write for every gate that asks: `forge hooks --how writes`.
4. **Prose.** Last, because it is read only by someone who chose to read it.
