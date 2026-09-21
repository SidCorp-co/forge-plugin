# `stats` — the change as the unit, and what no population here can answer

**A window is not a change.** `forge stats eval` compares the last fifty runs with the fifty before
them and names the copies inside each as a confounder. At nine releases a day that confounder is the
only thing in the corpus that *is* a harness change, and it carries almost no evidence: measured on
this project on 2026-09-21, over 582 admitted runs and 339 cache directories, 232 copies served at
least one run, only seven of them carried three or more runs that ran that copy alone, and the median
is nought. So a release is measured over one or two runs, forever, and waiting does not fix it
because waiting ships more copies.

`--since-release` did not close that gap and its name says it does. It resolves a held release reading
into the *before* window; the recent window stays the corpus's last `size` runs by end time, which are
not the runs that began after the release landed. That flag keeps the population it has — a shipped
criterion pins the confounding lines it prints — and its screen now says which runs its recent side is
taken from, and names this subject for the other population.

## Why the copy is the clock, and where it stops being evidence

A cache directory's name is the version and its creation time is when that version arrived. So the
runs that ran one change and no other are derivable without a new record: the runs that began at or
after that copy was installed and ended before the next copy was installed. The copy stops being a
confounder to warn about and becomes the identifier of the change a run actually ran.

It is an **inferred exposure and not an observed one**, and two things follow that the reading prints
rather than assumes. `installedCopies` substitutes the directory's modification time where the
filesystem reports no birth time; a modification time is not an installation, so a comparison resting
on one cannot carry the association, and the reading says of each moment which of the two it is.
And where no copy was installed after this one there is no upper installation at all: the population
is open-ended and is said to be, rather than closed at an endpoint no installation stands at.

## The three populations, and the one that is usually empty

- **The runs that ran this change and no other** — began at or after this copy's install, ended before
  the next one's. On this corpus this is nought to three runs for almost every change.
- **The runs that began under it, whatever ran later** — the same lower bound and no upper one. Large,
  and exposed to every change installed inside its span.
- **The runs before it** — ended before this copy's install, cut to the size of the side it answers, so
  the two figures stand on one count and the reference on the same two.

## Why the verdict associates and never credits

There is no control arm: a release reaches every later run at once. The copy clock is inferred
exposure. Two populations separated in time differ for reasons this corpus does not observe. None of
that is repaired by more runs, a threshold or a pre-declared prediction, and each of those was tried
on this issue's own thread and withdrawn.

So the reading names the set of changes a movement is **associated with**, states the identifying
assumption that would make an association credit — that the copy clock stands for exposure and that
nothing unobserved separates the two populations — and states that the assumption is not established
here. It never credits a change. A release that landed several issues can never have one of them
singled out, because the same runs ran all of them and no evidence here separates their contributions.

The three verdicts:

- **associated with N change(s)**, naming them. N is one only where one change was exposed.
- **no angle that returned a verdict moved past this corpus's own reference**. That is not *no effect*,
  and the reading says so on the same line.
- **undetermined**, carrying per comparison every reason it could not be used.

**`undetermined` is the ordinary answer**, not a degenerate number. Where nine releases land in a day
and a copy serves two or three runs, "these runs cannot be attributed to any one change" is the true
answer most of the time, and a reading that manufactured an attribution anyway would be worse than one
that declines.

## Judged is not eligible

A comparison is *judged* where at least one of its angles returned a disposition other than `not
evaluable`. It is *eligible to carry the association* where four things hold: it is judged; every
installation moment its population's bounds rest on is a birth time; no covariate's mix distance is
past that covariate's reference p95; and every covariate's reference was built over at least the
minimum adjacent positions. **Each of those vetoes one comparison and never the whole reading** — a
comparison whose covariate mix moved still holds real angle verdicts worth printing, and the other
comparison stands.

The narrowest eligible comparison decides. That precedence is fixed in advance so that neither result
is chosen for looking better, and it establishes no reliability of its own: three runs are three runs.
The other comparison prints whatever the verdict is, so disagreement between them is visible rather
than resolved.

## The mix, and the one direction it may be read in

For each covariate a run carries — the rung it ran at and the model it ran on, the two things fixed
before a run begins — the distance between the two populations' tallies is the total variation
distance, a value absent from one side counting as nought on that side. Its reference is that same
distance over every adjacent position of this corpus at the two sizes actually being compared, built
the way an angle's floor is, summarised at p95.

**It is not a null and it is not an equivalence bound.** The corpus's own adjacent positions cross real
releases and real drift. What it measures is how unusual a mix shift of this size is here. So it is
read one way only: past it withholds, inside it licenses nothing, and the block says so on every line.
A covariate that holds nothing back has established no comparability.

## The claim, and what a kept one is worth

A change states the one figure it expects to move, before it lands: `forge stats change ISS-nn --claim
wall:falls`. The angle comes from the shipped set and the direction from the two the angles already
speak, so a claim and the block above it can never disagree about which way a figure went.

The write is refused where a release reading held here already names that issue. **That check is local
and the guarantee is narrowed to match it**: a release whose reading was never written, a reading held
before readings carried keys, and the gap between a landing and its reading being recorded all look
exactly like an issue that has not landed. So the claim records that the write could not establish
landing, and the reading checks again on the way out against the install moment of the copy that
carried the change. That second check is the one that decides.

**A kept claim buys no evidence.** Pre-declaration makes a prediction falsifiable and stops an outcome
being written after the figure moved, which is the whole of what it is for. It supplies no
counterfactual, creates no independence between changes, removes no multiple comparisons and buys no
power — five correct predictions out of five is p = 0.0625 and cannot reach significance at that size
at all. The reading prints that beside every kept claim, because a run reporting a string of correct
predictions as proof the harness improved is the one misreading this whole subject exists to refuse.

## What is deliberately not here

No significance threshold, and no threshold borrowed from a study of another estimand: a rule about
percentage points of benchmark pass rate says nothing about median minutes. No regression and no
covariate adjustment — at these sizes neither has a defensible standard error.

No quality measure, and no phase table. Every figure here is a price, so all of them improving is as
consistent with runs having skipped what they owed as with the harness needing less of them. A phase
duration is how the work was spent and not whether the result was good: a phase that lengthens because
a run now reads a reference it once skipped is an improvement wearing a regression's shape. The six
conditions a quality figure would have to meet are in
[stats — the angles](stats-the-angles.md), and none of them is met by anything in this reading.
