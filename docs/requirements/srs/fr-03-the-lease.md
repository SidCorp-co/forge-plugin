# SRS §5 — FR-03 — The lease

Rev: 1 · Actors: agent · Enforces: BR-01, BR-05, BR-02 · Source: docs/issue-flow-contract.md

← [Index](./README.md) · [§4 FR-02 The tracker surface](./fr-02-tracker-surface.md) · Next: [§6 FR-04 Typed records](./fr-04-typed-records.md)

## Purpose

*Why does this requirement exist?*

Runs die: a context window fills, a process is killed, a machine goes off, a budget runs out. The
work has to survive that without a person reconstructing where it got to, and two runs must not
work one issue at once. A lease answers both: it says who holds an issue, until when, and who held
it before — in a field the issue already has, so no run has to remember anything.

A lapsed lease is a statement about a run and not about the work, which is why this product needs
crashed and failed to be different states. What survives an expiry, and where a resuming run picks
up, is `docs/issue-flow-contract.md`, "Crashed is not failed"; the duty here is that the lease is
the only thing that expires.

## Actors

*Who acts here?*

- **The agent**, which takes a lease before its first write and renews it by writing.
- **A person**, who needs no lease: comments, replies and reopening are theirs at any time.

## Use cases

*What does a lease do, and what does a dead run leave behind?*

### UC-03-1 — Take an issue

Rev: 3 · Actors: agent · Enforces: BR-05

A claim writes the holder, the renew time and the duration, and appends itself to the claim history
in the same write — so who held the issue when is on the record with no second write that could
fail or lie.

A payload write to an issue no run holds is a claim the caller has already made in everything but
the typing, and the exclusion is the tracker's compare rather than the order two commands were sent
in, so the write takes the lease instead of refusing and naming the command that takes it. A lease
taken that way covers the write and not the run: a call that had to claim for itself is the whole
of what that call does to the issue, so the lease goes back when the write lands rather than
standing until a clock runs out, and a run with work following says so by claiming for itself. An
issue therefore arrives at the status its next run claims from with nothing holding it. Where the
field is empty at a status only a lease's own writes reach, the write refuses as the claim would:
that state is a run that died or a write that erased one, and nothing may pick between those
readings silently. A field a lease was given back in is none of those three and says so, so the
next write and the next claim take it where an empty one is refused.

- **AC-03-1-1** · Rev: 1 · Proof: plugin/test/flow/lease.test.mjs "the claim history is appended by the write that made it, and a renew appends nothing"
  WHEN an issue is claimed THEN the CLI SHALL record the holder, the renew time, the duration and
  the claim itself in one write.
- **AC-03-1-2** · Rev: 1 · Proof: plugin/test/flow/lease.test.mjs "a lease is read out of the field, and anything else in it is no lease"
  IF the field holds anything that is not a lease THEN the CLI SHALL read it as no lease rather than
  as a claim it can renew.
- **AC-03-1-3** · Rev: 1 · Proof: plugin/test/flow/lease.test.mjs "a renew keeps the line the lease already held, and only a caller that says so clears it"
  WHEN a payload is written THEN the CLI SHALL renew the lease as part of that write.
- **AC-03-1-4** · Rev: 2 · Proof: plugin/test/flow/renew.test.mjs "an issue nobody holds is taken by the payload write itself, for the duration a write with no work under it is owed"
  IF a payload is written to an issue whose lease field holds no lease, and the issue stands at a
  status a run is dispatched at, THEN the CLI SHALL take the lease as part of that write, SHALL take
  it for the duration a write with no work under it is owed, SHALL record on the lease that no work
  followed it, SHALL name that take in the claim history under a word no other claim writes, and
  SHALL tell the caller that the write took it and will give it back.
- **AC-03-1-5** · Rev: 2 · Proof: plugin/test/flow/renew.test.mjs "a write finding no lease past the dispatch statuses is refused in the words the claim itself would have used"
  IF a payload is written to an issue whose lease field holds no lease and no record that one was
  given back, and the issue stands past the statuses a run is dispatched at, THEN the CLI SHALL
  refuse the write and SHALL name the claim that takes an issue no run is on, rather than one that
  is itself refused there.
- **AC-03-1-6** · Rev: 1 · Proof: plugin/test/flow/renew.test.mjs "the lease a write took for itself is given back once the write has landed, and the claim history is unchanged"
  WHEN a write that took the lease for itself has landed THEN the CLI SHALL give that lease back
  before the call ends, SHALL say on the record that it was given back rather than taken over, and
  SHALL add nothing to the claim history for it.
- **AC-03-1-7** · Rev: 1 · Proof: plugin/test/flow/claim/released.test.mjs "an advance to developed leaves nothing holding the issue, and another run claims it with no wait and no flag"
  IF the lease field records that a lease was given back THEN the CLI SHALL let the next write take
  it and the next claim be granted at whatever status the issue stands, rather than refusing as it
  does for a field no run left a lease in.
- **AC-03-1-8** · Rev: 1 · Proof: plugin/test/flow/renew.test.mjs "a lease the run claimed for itself outlives the write made under it"
  WHERE a run holds a lease it claimed for itself, the CLI SHALL leave that lease standing when a
  write of that run's lands, so a run carrying one issue across several calls keeps it.
- **AC-03-1-9** · Rev: 1 · Proof: plugin/test/flow/claim/released.test.mjs "a call that took the lease and then did not complete leaves the lease standing"
  IF a call that took the lease for itself does not complete THEN the CLI SHALL leave that lease
  standing, whether or not part of what it was asked for landed, because the run still owes the
  write that finishes it.
- **AC-03-1-10** · Rev: 1 · Proof: plugin/test/flow/claim/released.test.mjs "a take on a field a lease was given back in keeps the history and the line it left"
  WHEN a lease is taken on a field a lease was given back in THEN the CLI SHALL keep the claim
  history rows that field already carried, SHALL keep the line it left where the caller names none
  of its own, and SHALL leave nothing on the new lease saying it was given back.

### UC-03-2 — Refuse a second run

Rev: 2 · Actors: agent · Enforces: BR-01, BR-05

A live lease held by another run refuses the claim and every payload write, and the refusal names
the holder and the renew time — the two facts a person needs to decide whether to wait. The one
second run it does not refuse is the run the issue was dispatched to, which the record identifies
without anybody being asked to remember a flag; a dispatcher holding a lease over a write it has
already finished is not work, and waiting it out is the cost this exception exists to drop.

- **AC-03-2-1** · Rev: 2 · Proof: plugin/test/flow/lease.test.mjs "every refusal names the holder, its renew time and the one command that clears it"
  IF a live lease is held by another run, and that run is not handing the issue to this caller, THEN
  the CLI SHALL refuse and SHALL name that run and its renew time, and where the refusal is of a
  claim it SHALL also name the line the holder left on the lease and a way out that answers the
  reason this caller was refused.
- **AC-03-2-2** · Rev: 1 · Proof: plugin/test/tracker/precondition.test.mjs "the payload write carries the sessionContext its own renewal sent, and a moved one does not land"
  WHEN a payload is written THEN the tracker SHALL refuse the write if the lease field is no longer
  exactly what the writer read.
- **AC-03-2-3** · Rev: 1 · Proof: plugin/test/flow/claim/dispatched-claim.test.mjs "a run dispatched to the issue takes a live lease its dispatcher is only holding"
  IF a live lease is held by a run other than the one the issue was dispatched to, and the issue is
  at a status a run is dispatched at, and no landing checkpoint on it names a turn, THEN the CLI
  SHALL let the dispatched run take the lease and SHALL record the handoff as neither a first claim
  nor a dead run's reclaim.
- **AC-03-2-4** · Rev: 1 · Proof: plugin/test/flow/claim/dispatched-claim.test.mjs "a live lease is refused where its holder is another run dispatched to the same issue"
  IF a run other than the holder claims a live lease without asking for the turn a landing
  checkpoint names, and either that run is not the one the issue was dispatched to, or the issue is
  past the statuses a run is dispatched at, or a landing checkpoint on it names a turn, or the
  holder is itself a run the issue was dispatched to, THEN the CLI SHALL refuse the claim as it
  refuses any second run's.

### UC-03-3 — Reclaim what a dead run left

Rev: 3 · Actors: agent · Enforces: BR-05

Once the duration has passed the lease is open to any run, and the run that held it is no more
privileged than any other. The live test that settled that — and what it caught a build doing — is
ISS-4's run, whose records are on the tracker.

What a lapse does not say is that the run stopped. The lease is renewed by a write to the issue and
by nothing else, and the longest steps a run takes make none, so a run in a gate and a run that has
died leave one record. While the lapse is younger than the duration the holder itself named, the
reclaim is therefore refused and says so, and the taker clears the refusal by saying it has
established the run stopped — because the taking is the damage, and a run whose issue is taken while
it works loses every write it makes after that.

An empty field is the same uncertainty with less to read. A status past the ones a run is
dispatched at was reached by writes a lease covered, so a field holding none is a run that died
or a write that erased one, and never a first claim on untouched work. The holder cannot be asked
here, the record naming nobody, so the caller says instead that no run is on the issue, and the
history keeps a word of its own for that claim rather than the one an ordinary first one writes.

- **AC-03-3-1** · Rev: 2 · Proof: plugin/test/flow/lease.test.mjs "the five states, and a lease past its duration is another run's to take"
  IF a lease is past its duration THEN the CLI SHALL let any run reclaim it, by the route the age of
  the lapse decides, and SHALL refuse the former holder's next write as stale.
- **AC-03-3-2** · Rev: 1 · Proof: plugin/test/flow/lease.test.mjs "the claim history is appended by the write that made it, and a renew appends nothing"
  WHEN a holder retakes its own lapsed lease THEN the CLI SHALL append no handoff and SHALL count it
  toward no park.
- **AC-03-3-3** · Rev: 2 · Proof: plugin/test/flow/claim/fresh-lapse.test.mjs "a reclaim of a lease that has only just lapsed is refused, and the flag is what takes it"
  IF a lease is past its duration by less than that duration THEN the CLI SHALL refuse a reclaim by
  another run, unless that run is one the same exception admits against a live lease, and SHALL name
  the holder, how long ago the lease ran out, what a lapse of that age does not prove, and the one
  command that clears the refusal.
- **AC-03-3-4** · Rev: 1 · Proof: plugin/test/flow/claim/unheld.test.mjs "a claim on an issue past the dispatch statuses with no lease at all is refused, and the flag is what takes it"
  IF an issue holds no lease and stands at a status past those a run is dispatched at THEN the CLI
  SHALL refuse the claim, SHALL name that status and whatever the record still holds of the work
  the missing run left, and SHALL write the claim the clearing flag then takes under a name of its
  own in the claim history.

### UC-03-4 — A status that keeps dying reaches a person

Rev: 1 · Actors: agent · Enforces: BR-01, BR-05

Repeated reclaims of one status mean the work is not merely slow. Past a threshold the issue parks
for a person with the claim history as its evidence, rather than being picked up again by a run
that will die the same way.

- **AC-03-4-1** · Rev: 1 · Proof: plugin/test/flow/lease.test.mjs "the third reclaim of one status parks the issue, and other statuses do not count"
  WHEN one status has been reclaimed past the threshold THEN the CLI SHALL park the issue for a
  person and SHALL cite the claim history.
- **AC-03-4-2** · Rev: 1 · Proof: plugin/test/flow/lease.test.mjs "the third reclaim of one status parks the issue, and other statuses do not count"
  IF the reclaims are spread across different statuses THEN the CLI SHALL not park, since progress
  between crashes is progress.
- **AC-03-4-3** · Rev: 1 · Proof: plugin/test/flow/lease.test.mjs "a park older than the crashes it would answer answers none of them"
  IF a park already answered is older than the crashes it would answer THEN the CLI SHALL park
  again rather than treat the old answer as covering them.
- **AC-03-4-4** · Rev: 1 · Proof: none yet — ISS-35
  WHEN a crash park is written THEN it SHALL carry the claim history as typed evidence rather than
  as prose in its reason.

### UC-03-5 — One view of what needs attention

Rev: 1 · Actors: developer · Enforces: BR-01, BR-05

Leases live in a field per issue and parks in a status plus a record, so reading them means one call
per issue — which nobody makes. A supervising person or run needs both in one answer: every leased
issue with its holder and renew time, and every parked issue with who it waits on and since when.
It reads only, and needs no lease of its own.

- **AC-03-5-1** · Rev: 1 · Proof: none yet — ISS-24
  WHEN the view is asked for THEN it SHALL list every leased issue with its holder, its renew time
  and whether the lease is live, and every parked issue with its kind, who answers it and how long
  it has waited.
- **AC-03-5-2** · Rev: 1 · Proof: none yet — ISS-24
  WHILE the view is read nothing SHALL move, and no lease SHALL be taken or renewed by reading it.
- **AC-03-5-3** · Rev: 1 · Proof: none yet — ISS-24
  IF the issues read do not fit one page THEN the view SHALL say so with the same notice a browse
  gives.

### UC-03-6 — The lease follows the work

Rev: 2 · Actors: agent · Enforces: BR-01, BR-05

When the run that built a change ends before the change lands, the landing and the judgement are
other actors' work on the same issue, and each writes under a lease of its own rather than under
the builder's (BR-05). What says whose turn it is cannot be the lease's own next line, which a
transition clears; it is a landing checkpoint on the issue that transitions leave alone, whose state
names one turn at a time — the landing's, the builder's when a landing moved its files, the judge's
when a deployment is to be judged, and the builder's again where a status the landing is walking is
earned by a record only the run that built the change can answer for — and a takeover is allowed by
that state and refused naming it (BR-01). A turn the landing cannot discharge is handed over rather
than held: a refusal naming a record whose reason one actor knows and whose write another holds is
a wait no party can end.

- **AC-03-6-1** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a run declares its change ready to land THEN the CLI SHALL write a landing checkpoint on the
  issue holding the run's identity, the branch, the judged head, the base and the files touched.
- **AC-03-6-2** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a transition moves the issue THEN it SHALL leave the landing checkpoint intact.
- **AC-03-6-3** · Rev: 1 · Proof: plugin/test/flow/landing/checkpoint.test.mjs "at builder-owed a successor is held out by the builder's own lease and by nothing else"
  WHEN a lease is taken over THEN the CLI SHALL allow it only while the checkpoint's state names the
  taker's turn.
- **AC-03-6-4** · Rev: 1 · Proof: none yet — ISS-673
  IF the checkpoint is absent or its state names another turn THEN the takeover SHALL be refused
  naming the state.
- **AC-03-6-5** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a takeover is allowed THEN the CLI SHALL append the transfer and the state it was taken at to
  the claim history.
- **AC-03-6-6** · Rev: 1 · Proof: plugin/test/flow/landing/take.test.mjs "the builder's reconciliation moves the checkpoint to reconciled at the candidate it names"
  WHILE the checkpoint names the builder's turn and the builder holds the lease, a reconciliation
  write under that lease SHALL be accepted.
- **AC-03-6-7** · Rev: 1 · Proof: plugin/test/run/landing/land-ready.test.mjs "the builder writes the records the landing stops for, and the landing finishes on its own turn"
  IF a status the landing is walking is not earned, THEN the landing SHALL move the checkpoint to a
  state naming the turn of the actor whose record earns that status, SHALL record on it the state
  the turn was handed back from where that actor is the builder, and SHALL name the run that answers
  for what is owed.
- **AC-03-6-8** · Rev: 1 · Proof: plugin/test/flow/landing/take.test.mjs "the builder ends its records turn and the checkpoint goes back to the state it came from"
  WHEN the run holding that turn ends it THEN the CLI SHALL return the checkpoint to the state the
  turn was handed back from, without reading back the records it was handed over for.
- **AC-03-6-9** · Rev: 1 · Proof: plugin/test/flow/landing/reconciled-branch.test.mjs "a reconciliation over a branch that let the judged head go is refused, naming the push back"
  IF the branch the checkpoint names is proved, without reaching a remote, to no longer carry the
  head the checkpoint was written at, THEN the CLI SHALL refuse the reconciliation naming the push
  that puts that head back, because what a landing merges is that head and a branch moved under the
  hand-back leaves it reachable from no ref.
- **AC-03-6-10** · Rev: 1 · Proof: plugin/test/run/landing/moved-branch.test.mjs "a branch standing past the judged head refuses the landing, naming what is between them"
  IF the branch the checkpoint names stands on the remote at a commit other than the head the
  checkpoint was written at, THEN the landing SHALL refuse that change before it merges anything,
  naming both commits, what stands between them and the push that puts the judged head back on the
  branch, because the landing merges the judged head and a release cut over a branch that moved
  leaves the rest of it unlanded with nothing said.
- **AC-03-6-11** · Rev: 1 · Proof: plugin/test/run/run-checkpoint.test.mjs "a release finishes the ready checkpoint of the branch it landed"
  WHEN a release has landed and installed the change on the branch a checkpoint declared ready THEN
  that release SHALL leave the checkpoint in the state that names no turn, because a checkpoint
  still declaring a landed branch ready is what the next landing reads when it asks what this
  project left ready, and it would spend a gate, a version and a push on a merge that changes
  nothing.
- **AC-03-6-12** · Rev: 1 · Proof: plugin/test/flow/landing/moved-under-the-write.test.mjs "a checkpoint moved to a state the table would allow the move from is refused too"
  IF the checkpoint a landing write was decided on has been replaced by the time that write is made
  THEN the CLI SHALL refuse the write naming what moved, because the table of states cannot tell a
  checkpoint that stood still from one another run put a different change's landing on, and the same
  move is allowed from more than one state.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | every refusal names the holder, the renew time and the command that clears it |
| BR-05 | one holder at a time, and the history of holders is on the issue |
| BR-02 | the lease is a field of the record, so a resuming run reads it rather than remembering it |
