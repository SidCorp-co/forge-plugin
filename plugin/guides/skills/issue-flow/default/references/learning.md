# Learning selectively

**Most rounds record nothing.** The default at the end of a round is silence, with one exception.

## The audit every round owes

A run that closed an issue or handed it on audits what it shipped, once, before the round ends:
`forge-runner api projects/<id>/self-audits -X POST`, as `run`, naming the issue, each line of the
run rubric or card red flag the work tripped, and each act it should have reached for and did not.
Its card is read with `forge_describe { action: "audit.self" }`, which carries the rubric and the
shape. A clean round sends `failed: []`, which is a record and not silence: it is what lets a miss
reported next week be read against a round that said it had none.

The audit is not this reference's other learning. A failed line goes to core as a correction the
steward draws lessons from, and a miss is counted on the card it names, so neither is a memory or a
skill edit here; what follows still decides those.

<!-- forge:when feedback.plugin off -->
## The defect this project sends nowhere, and what the report owes for it

A defect in the tooling still costs the round whether or not anybody may file it, so what is asked
for is the figure rather than the silence: the cause at its line, and what the round spent getting
past it, in the report. A report saying only that something was awkward prices nothing, and the
next round pays that cost again with no more evidence than this one had.
<!-- forge:end -->
<!-- forge:when feedback.plugin bugs all -->
## A defect in the tooling, and the four things its filing carries

File a tooling defect when you meet it, while its cause is still in front of you; what makes the
filing worth its round is where the defect comes from rather than where it showed.

- **The cause, at its line.** A verb, a clause, a condition — something a reader can open. Where the
  search found none, that is the answer and it says what was looked at: a cause nobody hunted for
  and a cause nobody could find read identically on the page, and only the second tells the next
  reader where not to go again.
- **The list of what is already open, read before the body goes.** It arrives whether or not anyone
  asks for it, so the only question is whether it is read while the decision is still open. Read
  after the write it is a second key somebody now has to merge.
- **A comment, where an open issue already names that place.** The finding belongs on the issue that
  will fix it. Two keys for one cause is a cause counted twice, weighed twice and fixed once, and
  the second key is the one closed as a duplicate by whoever notices.
- **The workaround, on that same issue, as a cost.** What the round spent getting past the defect is
  what prices fixing it. Filed as an issue of its own it reads as a request to build the workaround,
  which is the one outcome nobody wants.
<!-- forge:end -->
<!-- forge:when feedback.plugin bugs -->
A defect is the only shape this project sends, so what a run met that is not one — a verb worth
having, a step that reads wrong and held anyway — goes in the run's report and no further.
<!-- forge:end -->
<!-- forge:when feedback.plugin all -->
What a run met that is not a defect goes the same way and as the shape it is: this project sends
every shape, and one filed as a bug because that is the shape a defect takes is ranked as a bug for
the rest of its life.
<!-- forge:end -->

## What the learning gate reads

What it looks for in a record, and the categories a skill edit is typed by:
`forge hooks --how learning-gate`. Where project knowledge goes and what an
entry owes: `forge knowledge -h`, which names the values it classifies by too.

**Type the gap where you met it, before deciding what it earns**: a step of the method with no
branch for what happened, a section that sent the run the wrong way, a rule that contradicted the
tracker's own.
`forge record gap` has a kind for it, and for the run that met none.

## Where a skill learning lands

1. **Into a tool**, wherever the wrong state has a shape: a command matching a pattern, a field
   absent, a file missing, an ordering violated. A check that prints what it found and the next step
   shows the run its mistake whether or not anyone remembered the rule.
2. **Into the skill's own text, in the place its category belongs**, never appended to a general
   pile: the section for its category. A learning about the method itself is core's page's, and goes
   to core as feedback rather than into a copy here. A sentence in two places is a correction
   waiting to be missed in one.
3. **Nowhere**, which is the most common answer.

A rule that turns out to have been one project's convention is deleted, and the change says what
replaced it. A skill learning never goes into project memory: the project inherits a rule it never
agreed to, and the skill repeats the mistake in the next repository.

## The second occurrence is the promotion trigger

A trap that fires twice is evidence about the text the run followed: quote it, then fix that text
or give the run the tool it lacked. Wording the sentence more firmly is not a fix. If no tool can
show it, say why in the same change.

## Pruning is half of learning

Three things earn deletion from a skill:

- a rule a tool now shows, deleted the day that tool lands
- a rule the tool now documents itself, in a `-h`, a schema or an error message
- a rule whose reason expired

When a round records something, ask what it displaces.

## Changing the workflow itself

A step skipped three times is evidence about the step. Record the pattern first and change the
step once it has recurred; a workflow rewritten from a single bad round is fitted to that round.

## Where a rule goes, and why a hook is the last place

Push a rule as far down this list as it will go:

1. **A type.** Fires at compile, costs nothing to keep.
2. **A checker the gate runs.** Sees the whole tree, and is the authority on its own rule; a hook
   that reimplements one has created the second definition. It derives its cases rather than
   listing them: `forge hooks --how derive-dont-list`.
3. **A hook.** One tool call, tight timeout, near-zero tolerance for noise. Reserved for an action
   that leaves no tree to scan, and a write whose decision has to happen before the file exists. It
   teaches with a warning and the next step; a refusal is for kernel input alone — a write the
   tracker would refuse, a lease another holds, a destructive command, a secret leaving the box.
   What counts as a write for every gate that asks: `forge hooks --how writes`.
4. **Prose.** Last, because it is read only by someone who chose to read it.
