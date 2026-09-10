# the published baseline — the one result a citation may rest on

A baseline says what the tree already failed before the work started, and for most of a backlog it
is the same answer twice over: two issues cut from one commit have one baseline, and neither one's
size changes what that tree fails. So the run that measures it should be the run that already had to
— the ship, which gates the whole set before it releases — and every run cutting from that head
should read the answer rather than spend it again.

What was missing was not the compute. The gate's record is shared and a branch cut from an unchanged
head re-runs nothing, so the seconds were already saved. What no run could skip was the ceremony:
the invocation, the wait on it, and a record of its own saying what the last ten runs had said about
the same tree.

## Only a ship publishes one, and that is the whole of why it is believed

A citation is worth more than a claim because of who wrote the thing cited. A ship's result has a
known author, a whole scope by construction, and a commit the ship names anyway. Nothing has to
declare which command the project's gate runs, and no digest set has to travel on the record to
prove the claim, because the claim is the ship's and not the citing run's.

That is why no verb of this CLI writes a published baseline. A run publishing its own would let one
run's ad-hoc gate become the next run's authority, which is exactly the hole in citing *a recorded
gate result* with nobody named as its author.

## The commit, and nothing near it

The lookup is on one commit and it is exact. No range, no ancestry walk, no nearest match, and no
falling back on the newest thing published: a commit is the only thing here that says the tree is
the same tree, so a branch cut one commit later owes its own baseline. A result published for
another commit is worth precisely what no result is worth.

What already fails travels with the result, and that is not a courtesy. A citation carrying only a
commit leaves the citing run to guess what the tree was failing when the ship measured it, and a run
that guesses attributes an inherited failure to itself.

A scope the publisher cannot call whole is not published at all. The ship gates the whole set, so a
partial scope is a defect in its own reading of the gate's record rather than a result to hand on
with a caveat.

## Why the authority is settled at the write

The published store is a file on one machine, and that is what decides where the question may be
asked. `forge advance` answers off the record alone, so two checkouts of one issue give one answer —
and a store that one of them can read and the other cannot would break that outright. The write is
the other end: it has the checkout in hand, it is already reading git for the head it stamps, and it
happens once per baseline rather than at every rehearsal of every status. So that is where the
question goes, and by the time a record is read back the authority behind it is already settled.

The two ends are not alike, and this is the part worth knowing before it surprises you: **the write
is device-local and the record is portable.** A machine holding no publication for a head cannot
mint a citation for it, however many other machines published it — so the same write is taken on one
and refused on another. But once it has been taken, the record carries the gate, the result, the
commit, the scope and the ship it came from, and any machine's `advance` reads it as it reads every
other payload. Nothing about a transition depends on which machine is asking.

That asymmetry is the safety property rather than a cost of it. A missing publication costs one gate
run, which is what the run would have spent anyway; a publication that travelled would let a run
lean on a green nothing in front of it can check. Only the first of those is reachable from here,
and it was chosen for that reason.

The rung is no part of it either, and used to be. While the rung was the condition, the saving read
as a concession granted to a small issue — which had the rule backwards, since what a tree fails is
a property of the tree. A `feature` cut from a published head is owed the same answer as a
`trivial`, and withholding it made the heaviest issues re-measure a tree somebody had just measured.

## A citable result nobody can discover is a route nobody takes

That was the state one release left: a rule telling a run to name where it read a result off, and
nothing anywhere able to answer what result existed. The only runs that could take the route were
the ones that had watched a gate pass at that exact head, or been told by whoever dispatched them —
which is not the common case and never will be. So the rehearsal answers it, and it answers with the
head in hand rather than with a list, because a result and the tree it answered for are one fact.

The rehearsal is where that answer belongs and not the entry check, which is the same division the
whole verb keeps: it says what a status would cost while a run can still act on it, and refuses
nothing. `forge advance <ref> --owed` is what to type; what it prints is the method's, not this
page's.

Read with this: [`the-entry-checks`](the-entry-checks.md) for what the citation is weighed on once
it is written, [`advance`](advance.md) for the division the rehearsal keeps, and `forge guide
issue-flow verification` for the phase that spends this.
