## Phase 7 — Ship

Take the integration and deploy path Phase 0 discovered, on the route the ship mode it read names.

<!-- forge:when ship self -->
**The landing is this phase's first step where Phase 5 has not already taken it**, and it is one
landing and one mark either way. What the mark carries: `forge guide contract developed`.

**The ship is the longest wait a run has**, and it obeys the rule every other wait here does, which
the poll guard enforces on its own log too: `forge hooks --how polling`, read before the first read
of that log rather than after the guard refuses the second.

Then verify the change where it now runs, post the release note, and move the status, in that
order: a note published before the change ships announces what has not happened, and the status is
what other people's queries filter on, so it moves last. What the move is owed:
`forge guide contract awaiting_release`.

**Where the release reaches production on its own, this phase looks at production.** Read the
identity the production deployment reports serving, and take the journey this change touched once,
in a way that is safe to take there. A deploy log is a record that a command finished, and staging
green with a valid identity says nothing about the authentication, the assets, the routing and the
configuration a user meets on the other side. What that observation found, and the route back if it
found the change broken, go in the report with the identity they were taken at.

**Then close it, in this phase**, where the project's release owes a person nothing. A run that
stops on `awaiting_release` under a release that has already happened has handed a person the one
keystroke this workflow exists to take over. Where a person still owes that release an act, the
issue rests at the rung and the close is theirs. Which of the two this project is, is the release
policy's answer and never the ship mode's, and `forge resume ISS-nn --report` prints it there. Where
the contract hands the issue to somebody instead, a park or a reopen, it stays where it is and the
report says which.

**An issue this run leaves standing carries the handoff on the issue itself**, not in a transcript
nobody queries: who holds it next, whether the change is live in production or only where it was
judged, the identity serving it, what the judgement rests on, the one act that is owed, and what to
do instead if that act is refused. *Automation complete* and *product accepted* are two different
states, and an issue that does not say which of them it is at looks exactly like a run that died
here.
<!-- forge:end -->
<!-- forge:when ship ready -->
**This phase ends at ready-to-land and lands nothing**, because the landing is one actor's per
checkout. Push the branch and leave the checkpoint that says it is ready:
`forge claim ISS-nn --pushed --ready`, whose `-h` is the authority on that capture and on the
states after it.

**The lease is handed over and never dropped**: a run that abandons it leaves an issue nobody may
write to until it expires. Phase 5's record and Phase 6's drafted note are written before that
checkpoint, because the landing writes neither — it moves the statuses those records earn and
writes none of them.

**What the landing does with it is not this run's to do**, and one outcome comes back: a merge that
touched a path the change owns, which leaves the checkpoint at `builder-owed` for the run that built
it to take, read the candidate named there, and answer for that candidate by its sha — `forge claim
ISS-nn --take`, then `forge claim ISS-nn --reconciled <sha>`. Anything else the landing settles
itself, and `forge resume ISS-nn` says which happened.

**The judging is this run's and the statuses past it are the landing's**, because the release they
answer for does not exist while this phase runs. The landing walks as far as the record earns and
the project's release allows: to `closed` where that release owes a person nothing, and to
`awaiting_release` where a person still owes it an act, which is a stop by decision and not a gap.
So leave the Phase 6 note on the issue, which is what those last rungs are earned by, and let the
report say the statuses are the landing's rather than reporting them moved — and say which state
the issue is left in, because a reader of the rung alone cannot tell a change that is live from one
waiting for a person.
<!-- forge:end -->

**A failure anywhere along the path is condition 3**: roll back by the route Phase 0 established,
and report with the evidence rather than retrying past it.
