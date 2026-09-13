# `stats runs` — the two tables a run's time is divided by

**A row absent from a table reads exactly like a row that costs nothing.** The phase table cuts a
run's wall clock by the method's own phases and the rung table by the rung it was worked at, and
both keep a row for whatever they found none of, because the alternative is a reader concluding
from silence. What a single call is classed as, which is what both tables are counted off, and the
refusals listing that shares that classifier: [`stats-rows.md`](stats-rows.md).

## The phase table

**The rows are the method's phases, as `forge guide issue-flow` numbers them, and that table is the
only one.** Phase boundaries are read off the first call of each kind, because no run writes a phase into its own
transcript — and off the **class** the call already carries, so two readings of one call cannot
disagree about what it was. A phase already passed cannot pull a run backwards,
the review does not open before the build has — the plan is consulted before it is written, and that
consult is the plan's — and the ship call is the last call of its own phase rather than the first of
the next. A boundary is the write that discharges the phase before it, so a row holds its own work.

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
push the phases past the wall (ISS-308).

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
row per rung and one more for the runs that claimed none. What a rung *drops* is three payloads and
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

**A batch counts at the largest rung among its members.** A run carrying three issues is as
expensive as its heaviest, and filing it under the cheapest would make every rung look better the
more work was batched onto it.
