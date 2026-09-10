## Phase 6 — Fold

Every report is folded, whatever it says: what landed, what was filed, what a restart is owed for,
and what a run declined and why. A claim a report makes about work filed elsewhere is checked by
reading that thread, not taken.

<!-- forge:when ship ready -->
**Where the runs end at ready-to-land, the landing is this phase's and it is one actor's.** Every
branch a run left with a ready checkpoint is landed from this checkout, in the order the fold names
them. Landed here they are gated against the base as it actually is at that moment, which is what a
run's own gate cannot be while its siblings are still landing.

A branch handed back is not a failure of the fold, and one thing hands one back: a merge that touched
a path the change owns, which leaves the checkpoint at `builder-owed`. The run that built it is
resumed as a parked run is, by the same agent and from the checkpoint. A base that moved under the
pin hands nothing back — the landing builds the candidate again from the new base itself, and what
that costs is the readings taken at the candidate it gave up. A branch that will not merge at all is
parked with its conflict list and lands nothing; the one after it is somebody else's release, so the
fold carries on rather than stopping at the first refusal.

**Where the project asks for an independent judge**, the landing stops for one and the fold
dispatches it: a role of its own, given the issue, its criteria and Outcome, and the deployment
identity the checkpoint names — never the run that built the change, whose own verdicts earn nothing
there. Its verdicts and its hand-back are what let the landing finish.

**The two statuses a landing does not reach are this phase's too.** The release note each run left
drafted is published from here, once the release those statuses answer for is actually out, and
`awaiting_release` and `closed` are moved from here. A wave that lands every branch and moves neither has left the queue
exactly where a person has to finish it, which is the one outcome this method exists to remove.
<!-- forge:end -->

**A run that parked is resumed, never replaced.** When the block it named clears, the same agent is
messaged to continue from the phase its park named; its reading, confirmation and narrowings are
already in its context, and a fresh dispatch pays Phase 0 and Phase 1 again to re-derive them. A new
agent goes out on a parked issue only when the parked one no longer answers, and the fold says so.

The wave's own cost is measured against what it saved — the dispatcher's minutes and calls against
the readings the executors did not repeat and the dispositions taken before a run was ever spent. A
net cost asserted rather than counted is the thing this skill was built to stop doing.

What a section owes, where it is written, and what closes the wave: `forge guide dispatch the-fold`.
