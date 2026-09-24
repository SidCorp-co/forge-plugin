# `stats` — which model ran the run, and what the reading refuses to conclude from it

A dispatcher's question is not *which model is better*. It is *which kinds of issue can go to a
cheaper model without costing more than they save*. `forge stats models` is the reading that question
is asked of; this topic is why it is shaped the way it is, and what it will not say.

## Ranking by minutes would recommend exactly the wrong model, confidently

A cheaper model that finishes sooner and lands a worse change is not cheaper. It has moved the cost
onto the next run, onto the reviewer and onto whoever reopens the issue. A reading that ranked arms
by wall time would find that model first and print a number to two decimal places about it.

So no figure here stands alone. Every model row carries a spend half — the medians `stats runs`
already computes over a set of runs — and a got half: whether the run took its landing step at all,
how many consult findings were accepted against them and how many rejected, how many gate runs they
spent, and what the tracker says happened afterwards. Both halves come from the folds the other two
subjects already use, `profileOf` and `outcomesOf`, so a figure cannot move in one reading without
moving in the others.

## The landing figure is the run's act, never the issue's fate

`run took the landing step` is read off the run's own transcript and never off the tracker. It says
the run reached the phase where it ships, captures the ready checkpoint or records the verification
for itself. It does not say the issue landed: under a ship mode that leaves the landing to the
dispatching session, a run that did everything asked of it never takes that step, and an issue
closes on a landing no run of this corpus made. On the corpus of 2026-09-21, two of sixteen runs on
one arm had taken the step, while eight of the issues those runs worked were closed and released.
The name carries that, because a figure named for the issue's outcome and counted off the run's
transcript is the misreading this table exists to prevent.

## A figure read partly says so on its own row

The outcome figures read the tracker under the `--requests` budget, and a budget that runs out
part way through the walk leaves a figure counted over the issues it reached first. That count
prints like a whole one — `3/354` over a population of five hundred reads as three in three hundred
and fifty-four — so each row prints how many of its pairs a read that did not complete left out.
Where the spent budget is what left them, the row says `cut short` and names `--requests` above the
budget it was read under, the one flag that reads more of it; where the budget held and a thread
still would not read, the row gives the count alone, since no flag here reads that thread. A pair
kept out because its run has not finished the horizon is neither: no budget reads it sooner.

A figure cut short on either arm is no side of a comparison, whatever its count. The part a spent
budget reached is whichever issues the walk met first, which is not a sample of the arm.

Every outcome row also prints the runs behind its figure beside its count, because a figure counted
over run-and-issue pairs is not counted over runs, and the next section's floor reads both.

## The floor is per figure and per cell, and that is the whole of what is comparable

This is the rule that terminates. **One arm's figure is comparable with another arm's exactly where,
inside the same cell and on both arms, that figure's own population reaches ten and at least ten runs
stand behind it.** Everything outside that region prints its count and the word `thin`, and the
reading names the pairs inside it figure by figure rather than leaving a reader to divide.

Both halves, because they are not the same population. The first run of this reading over a real
corpus printed `parked or dropped 41/41` for an arm with three runs and called it comparable: one of
those three had claimed forty-one issues, and a figure counted over run-and-issue pairs had cleared a
floor asked of the pairs alone. Forty-one observations of one run is one observation of the model.

And the runs behind a figure are the runs that *contributed to it*, not the runs of the row. An arm
of ten runs whose tracker threads went unread for nine of them has one run answering for every
outcome figure it prints, and the row's count would have lent that figure the other nine. So each
outcome figure carries the distinct runs its observations came from, and it is that number the floor
reads.

The figure's own population is never replaced by the arm's total, which is where an aggregate floor
goes wrong in both directions at once. A model with twelve runs and two of them at the `fix` rung is
thin at that rung, whatever its total says. A model with twelve runs whose tracker thread could be
read for one of them has a population of one on every outcome figure, and the same twelve runs say
nothing about it.

A cell is read exactly as the whole reading is, spend half and got half both, and that is deliberate
rather than thorough: a cell declared comparable on minutes alone, silent on what those minutes
delivered, is the same wrong recommendation one rung further down — and the cut is where a dispatcher
actually decides, so it is the last place to leave the half out.

A class this reading never recognised has no population at all, which is a third answer beside a
figure and a zero. Where nothing in the corpus was classed as the gate and the checkout declares no
gate command, the column says so and the arms are compared on everything else: a median of nought
over a class nobody measured, set beside another arm's, is the most confident wrong number the
reading could print.

**`mixed` and `unattributed` are accounting, not arms.** Both keep every row and every figure, because
the rows have to add up to the corpus. Neither is ever a side of a comparison: `unattributed` names no
model anyone could choose, and a `mixed` population can contain the very model it would be set
against.

Where no pair clears, the reading says so in a sentence rather than printing an empty block: a reader
given nothing cannot tell a reading that compared nothing from one whose comparisons were left out.
On this project's own corpus on the day this landed, that sentence was the whole answer — 463 runs on
one arm against four and three on the others — and it is a better thing to hand a dispatcher than a
confident number computed from three runs.

## A window narrows what is reported, never what a ruling is paired against

`--since` cuts the runs the reading prints. It does not cut the corpus the rulings and parks are
resolved over, which stays whole, for the reason `stats eval` resolves those before any window is
cut: a competitor outside the window still spoils a match. A narrower window that hid the competitor
would hand the run inside the window findings nobody earned, and could walk a figure across the floor
by asking for fewer days.

## A synthetic turn is not a model, and a run two models wrote answers to neither

The host writes the model on each assistant record, and it writes the literal `<synthetic>` there for
a turn no model generated. Any model id the host wraps in angle brackets is a marker of that kind, so
it names no arm and is dropped before the attribution rather than counted as a model nobody can
dispatch to.

After that drop a run names one model, more than one, or none. One is the arm. More than one is
`mixed`, never the busier of them: a run two models generated is a run neither answers for. None is
`unattributed`. Both keep rows of their own, because rows that add up to the corpus and rows that add
up to the part of it with a name are different readings, and only one of them can be checked.

## The cut is the issue, because that is what a dispatcher chooses

Nobody dispatches a model. They dispatch an issue to a model, so the second table cuts the same rows
by the rung the run worked at and the complexity of the issue it owned — the form of answer this
exists to make possible being *at the `fix` rung and `s` complexity these two are indistinguishable,
and at `l` they are not*. A run that owned several issues takes the largest complexity among them,
which is the batch rule the rung already keeps — and no complexity at all where one of those issues
could not be read, because the unread one may be larger than the largest read. The exception is a
batch already holding the top complexity, which nothing unread could beat.

A run at no rung keeps a row of its own. An observation at no rung establishes nothing about a named
one, and dropping it would leave the cut short of the corpus it was cut from.

**The rung has two sources here, and the run's own record is the first of them.** A transcript that
kept a confirmation the reading can still read gives the rung that run was *worked at*, which is what
it was told at the time; the complexity this reading already holds for the same issue gives what the
issue reads at *now*, and the two part company wherever a re-triage moved the field. Preferring the
record therefore moves only the runs nothing else could class, and preferring the complexity would
quietly re-file runs whose rung was never in doubt.

The second source is what the cut is for. Three in five runs over two real corpora carried no
readable rung at all — some wrote no confirmation, the rest lost the record's tag to the host's
truncation, which ISS-1689 answered as far as a transcript can be answered. Those are unreachable
from the transcript by construction, and the complexity beside them in the same expression is the
only thing left that knows. Which runs were classed that way is printed with the cut, because
`stats runs` reads the tracker nothing and files the very same runs at no rung: the two verbs
disagree by design, and a reader who cannot see which reading each made would read that as a figure
that moved.

What is left at no rung is every run neither source answered for: one no claim joined to an issue,
one whose issue the tracker answered no complexity for, and one batch whose unread member could be
larger than its largest read. The first of those is the attribution gap, a different question from
this one and the larger half of the number.

## What this reading is not

It routes nothing. It produces the reading a person or a dispatcher decides on, and chooses no model
for anything. It says nothing about money, because the corpus records tokens and time and a price
table here would go stale rather than fail. It says nothing about the consult model — that is the
second-opinion provider, `forge codex eval` covers it, and merging the two would attribute a review's
cost to the model that drove the run. And delegation to a role is not delegation to a model: the
corpus is issue-flow runs, which is what holds the role axis still while this one varies.
