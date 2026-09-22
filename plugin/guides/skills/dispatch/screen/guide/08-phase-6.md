## Phase 6 — Fold

Every report is folded, whatever it says: what landed, what was filed, what a restart is owed for,
and what a run declined and why. A claim a report makes about work filed elsewhere is checked by
reading that thread, not taken.

<!-- forge:when ship ready -->
**Where the runs end at ready-to-land, the landing is this phase's and it is one actor's.** Every
branch a run left with a ready checkpoint is landed from this checkout, in the order the fold names
them. Landed here they are gated against the base as it actually is at that moment, which is what a
run's own gate cannot be while its siblings are still landing.

**The switch that put it here is the project's ship mode, read at `ship ready`.** A project set to
`ship self` lands nothing here: each run ships its own change as its last phase, and this phase folds
reports of releases that already happened. So this block appears because of a configuration and not
because of a wave, and what it costs is the reason that configuration exists.

**One gate is spent on the set and on no subset of it.** That is the whole of the saving, and it is
what makes landing four branches together cheaper than four runs shipping in turn, each waiting on
the release before it. It is also a bet. Changes that pass by themselves can still fail in
combination, and when they do the whole set's reading is spent for nothing and each of them goes on
to land by itself. So a set that fails costs one gate more than landing them one at a time would
have, and the size of a set is a judgement this phase makes rather than a number to maximise.

**Where the project asks for an independent judge before the merge, no set is built at all** and each
branch is landed on its own however disjoint their paths are. A wave composed for a cheap landing
buys nothing under that route, and the route is the project's rather than this phase's to choose.

A branch handed back is not a failure of the fold, and one thing hands one back: a merge that touched
a path the change owns, which leaves the checkpoint at `builder-owed`. The run that built it is
resumed as a parked run is, by the same agent and from the checkpoint. A base that moved under the
pin hands nothing back — the landing builds the candidate again from the new base itself, and what
that costs is the readings taken at the candidate it gave up. A branch that will not merge at all is
parked with its conflict list and lands nothing; the one after it is somebody else's release, so the
fold carries on rather than stopping at the first refusal.

**Where the project asks for an independent judge**, the landing stops for one and the fold
dispatches it: a role of its own, given the issue, its criteria and Outcome, and whatever
deployment identity the checkpoint names — never the run that built the change, whose own verdicts
earn nothing there. A checkpoint naming none refuses that judge nothing; it is the route the landing
took that decides whether there is one to hand over. Its verdicts and its hand-back are what let the landing finish.

**A status the landing could not reach is this phase's.** The landing takes each issue as far as its
record earns and the project's release allows, which is to `closed` where that release owes a person
nothing. Where it owes one, the issue rests at `awaiting_release`: the release note each run left
drafted is published from here once the release is actually out, and the close follows it. A wave
that lands every branch and leaves a rung nobody moves has left the queue exactly where a person has
to finish it, which is the one outcome this method exists to remove.
<!-- forge:end -->

**A run that parked is resumed, never replaced.** When the block it named clears, the same agent is
messaged to continue from the phase its park named; its reading, confirmation and narrowings are
already in its context, and a fresh dispatch pays Phase 0 and Phase 1 again to re-derive them. A new
agent goes out on a parked issue only when the parked one no longer answers, and the fold says so.

The wave's own cost is measured against what it saved — the dispatcher's minutes and calls against
the readings the executors did not repeat and the dispositions taken before a run was ever spent. A
net cost asserted rather than counted is the thing this skill was built to stop doing.

What a section owes, where it is written, and what closes the wave: `forge guide dispatch the-fold`.
