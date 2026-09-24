# `stats runs` — the two tables a run's time is divided by

**A row absent from a table reads exactly like a row that costs nothing.** The phase table cuts a
run's wall clock by the method's own phases and the rung table by the rung it was worked at, and
both keep a row for whatever they found none of, because the alternative is a reader concluding
from silence. What a single call is classed as, which is what both tables are counted off, and the
refusals listing that shares that classifier: [`stats-rows.md`](stats-rows.md) and
[`stats-the-refusals.md`](stats-the-refusals.md).

## The phase table

**The rows are the method's phases, as `forge guide issue-flow` numbers them, and that table is the
only one.** Phase boundaries are read off the first call of each kind, because no run writes a phase into its own
transcript — and off the **class** the call already carries, so two readings of one call cannot
disagree about what it was. A phase already passed cannot pull a run backwards, and
the review does not open before the build has — the plan is consulted before it is written, and that
consult is the plan's. A boundary is the write that discharges the phase before it, so a row holds its own work.

**Every phase is opened by a row, including the last.** The ship row once closed its own phase, which
put the run in the phase past it at its first landing call with nothing able to move it out: the
shipping phase measured one call, and the phase after it measured every call to the end of the
transcript. The method ends the shipping phase at the close and gives the phase after it the cleanup
and the learning, so over 354 of this project's runs that unbounded row held the release wait, a
resumed landing, a post-ship gate and the shipping phase's own verification and merged marks — 4,523
of its 5,757 minutes fell before the last status move, under a label reading `Learn`. So the landing
opens the shipping phase and leaves it open, and the row after it opens on the call that ends the
run's workspace or on a write of what the run learned. That last row waits on the shipping phase
having opened, because the method types a gap where the run met it and reads the knowledge store
before it has read any code: without the wait, either would take a run that landed nothing to the
last phase (ISS-1714).

**The review opens on the read that earns it and on no other consult.** A build commits several
times and each commit is gated by a consult over what that commit stages, so a boundary drawn at the
first consult after the build began was drawn at the first commit: on this project's own corpus that
row carried 429 gate runs and 991 test runs beside its consults, and a rise reported there was the
build's tail moving, not the review's cost.

**The phases sum to the wall.** The brief that opened a run and the report that closed it are
generation the run spent, and the run's clock counts both; the phase fold once counted only up to the
last call's result, so the closing report landed in the wall and the model share and in no phase at
all, understating by exactly itself the phase every run ends in — on this project's corpus, forty-four
of forty-five runs and seventeen minutes in total. The tail is measured from the latest result the
fold has reached rather than from the last call's, because the harness issues several calls in one
turn and a pair whose later call returned first would otherwise have its overlap counted twice and
push the phases past the wall (ISS-308). It goes to the phase the run stands in and not to the one its last
call is booked in, because the note's row books its call elsewhere: a run whose last call was the note
had its whole closing report read as the cost of writing release prose (ISS-1913).

**The note is counted where it is posted, and opens nothing behind it.** The method has no single
order for it: under one ship mode Phase 7 posts the note after the landing, and under the other the
note is written before the ready checkpoint of a run that never invokes the ship at all. A row that
opened a segment measured neither — the late note fell past the ship into the last phase, and the
early one swallowed every call to the end of a run with no ship to close it, which is how 222
minutes of pre-ship gate came to be read as the cost of writing release prose. So that row books its
own call and moves the run's phase for nothing after it, and the two orders are counted instead:
over 434 runs, 101 posted the note before a ship, 157 after one and 37 in a run that never shipped.
A run taking either order is visible rather than reclassified into the other (ISS-1583). The landing
the order is read against is every way the landing's phase opens, the ready checkpoint and the
verification record as well as the ship, and `stats models` counts a run as having reached the
landing off the same reading, so the two verbs cannot answer differently about one run (ISS-1913).

Each of those last two rules is declared on the marker row it constrains rather than beside the cut
it makes, so a phase number is written once. Renumbering a phase then moves the cut with it; a
second copy of the number would go on matching a phase that had moved.

Each phase's minutes and calls are medians **over the runs that entered that phase**, with the count
of those runs beside them. A median over the whole window reports a phase most of it never reached as
costing nothing, which is the opposite of what it costs the runs that do reach it — and on this
corpus that read the judging phase as zero minutes and zero calls while a third of the runs were
spending five minutes there.

## The rung table

The ladder's rungs are what a change's cost is meant to differ by, so the profile groups by them: a
row per rung and one more for the runs that claimed none. What a rung *drops* is payloads, which are
visible in the record; what it *saves* is rounds, and rounds are only ever visible here. That is the
whole reason this table exists — without it the two rungs below `feature` differ in nothing a reader
can act on, and the next change to the ladder would be argued from memory.

A run's rung is read off **the confirmation it wrote**, which carries it as a `derived` field: the
write fills it from the issue's own description and refuses it as a flag, a value the author could
type proving only that they typed it. It is a copy for this table and never a source — every entry
check reads the description — so a hand-written confirmation lacking the line is refused nothing and
one claiming a rung the description does not moves no status.

The call's own class picks which call to read, and the record inside its output says which line is
that write's. A `forge issue` or a `forge resume` printing the same thread carries the line too, and
read from those a run is filed under the rung of whatever issue it happened to open; so does anything
the same shell call printed after the write, which a class covering the whole call cannot tell apart.
A run that confirmed nothing is `unknown` and keeps its own row: folded into a rung it would flatter
that rung, and dropped it would leave a table that quietly counts fewer runs than the profile above
it.

**And it stays `unknown` here even where the backlog would answer**, because this verb reads nothing
the tracker holds and a rung worked out from an issue's complexity would make that claim false. The
route out is the other verb: `forge stats models` already reads the tracker for the complexity half
of its own cell, so it classes that same run at the rung the complexity claims and says on its table
how many it classed that way. Two verbs therefore file one run at two rungs, and each names the
reading it made rather than leaving the reader to guess which one moved.

**A batch counts at the largest rung among its members.** A run carrying three issues is as
expensive as its heaviest, and filing it under the cheapest would make every rung look better the
more work was batched onto it.
