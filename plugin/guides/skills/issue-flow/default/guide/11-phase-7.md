## Phase 7 — Ship

Take the integration and deploy path Phase 0 discovered. The ship mode it read says how far this
phase goes, and the text below is the route that mode names.

<!-- forge:when ship self -->
**The landing is this phase's first step**: the change goes onto the default branch here, after the
judging. What the mark written there carries: `forge guide contract developed`.

**The ship is the longest wait a run has**, and it obeys the rule every other wait here does, which
the poll guard enforces on its own log too: `forge hooks --how polling`, read before the first read
of that log rather than after the guard refuses the second.

Then verify the change where it now runs, post the release note, and move the status, in that
order: a note published before the change ships announces what has not happened, and the status is
what other people's queries filter on, so it moves last. What the move is owed:
`forge guide contract awaiting_release`.

**Then close it, in this phase.** A run that stops on `awaiting_release` has handed a person the one
keystroke this workflow exists to take over. Where the contract hands the issue to somebody instead,
a park or a reopen, it stays where it is and the report says which.
<!-- forge:end -->
<!-- forge:when ship ready -->
**This phase ends at ready-to-land and lands nothing**, because the landing is one actor's per
checkout. Push the branch and leave the checkpoint that says it is ready:
`forge claim ISS-nn --pushed --ready`, whose `-h` is the authority on that capture and on the
states after it.

**The lease is handed over and never dropped**: a run that abandons it leaves an issue nobody may
write to until it expires. Phase 5's record and Phase 6's drafted note are written before that
checkpoint, because the landing writes neither — it moves `developed` and `testing`, the
statuses
those records earn, and no status past them.

**What the landing does with it is not this run's to do**, and one outcome comes back: a merge that
touched a path the change owns, which leaves the checkpoint at `builder-owed` for the run that built
it to take, read the candidate named there, and answer for that candidate by its sha — `forge claim
ISS-nn --take`, then `forge claim ISS-nn --reconciled <sha>`. Anything else the landing settles
itself, and `forge resume ISS-nn` says which happened.

**Where the project asks for an independent judge**, the landing stops for one and the judgement is
another run's: this run neither writes those verdicts nor waits for them. Whether that stop sits
before the promotion or after it is the project's landing route, which Phase 0 read.

**`awaiting_release` and `closed` are the landing actor's, not this run's**, because the release those two
answer for does not exist while this phase runs. So leave the Phase 6 note drafted on the issue for
whoever publishes it, and let the report say the two statuses are owed rather than reporting them
moved.
<!-- forge:end -->

**A failure anywhere along the path is condition 3**: roll back by the route Phase 0 established,
and report with the evidence rather than retrying past it.
