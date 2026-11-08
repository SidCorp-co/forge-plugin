## Where it hands over

Four conditions, and any one of them ends this run's authority rather than its usefulness:

- **A permission you do not have.** Not a thing to work around, and not a thing to try once more.
- **A state you cannot determine.** Where the world will not tell you what it is, no action taken
  against it is better than a guess with consequences.
- **Several causes of equal weight.** The grading says name them; the boundary says do not pick.
- **A decision that is a person's to make.** Irreversible, real money, credentials or product direction.

**A failed production observation ends the success path, and never in a close.** The release is not
announced, the status is not moved past the rung, and nothing is marked done on the strength of a
reading that failed. Where the repair is yours to make and no bound has been crossed, repair forward
and read again — that is the ordinary case, not an exception to this. Where it is not yours, or a
bound has been crossed, hand over.

The handoff is written where the work is tracked, and it names four things:

1. **Who owns it next** — a role or a person, never *someone*.
2. **The deployment state and the identity you observed** — the readings themselves, not your
   summary of them, so the next run starts from evidence rather than from your conclusion.
3. **The act still outstanding** — the one thing that has to happen, said as an action.
4. **The fallback** — what to do if that act cannot be taken, including *nothing, and here is who
   decides* where that is the honest answer.

**A gate a person owes holds the run open, and is never a reason to abort it.** Where the deploy
answer names a person in `waitsOn` (a production deploy pending an admin's confirm), or a blocker's
`owes` is a human, the run is waiting, not stopped. Write who owes the act, the act and the door it is
taken at, from `waitsOn` or the blocker's `waitingFor`, where the work is tracked, then end the turn
with the run still open. Only two things end it: the confirm, which carries the same run on with no
re-cut, or a person's explicit cancel. Your abort is not one of them: it would carry the cut tag, and a
version that left with its tag is never cut again (`RELEASE_CUT_VERSION_BEHIND`).

**Any other end goes through the abort route the job prompt names, and it is owed a reason.** The
handoff note above is for the next owner; the release itself ends by calling that route (`POST
…/releases/<version>/abort`) with a `reason` that names the step the run stopped at and the cause — the
hand-over condition and the reading behind it. An abort with no reason records only "aborted by agent",
which says nothing about why it stopped. A CLI verb for it refuses an abort with
no reason, the way `forge release-batch clear` does.

**A roster already shipped in an earlier version closes on the abort, rather than being held.** Where
the cut aborts because every issue in the roster is already in a released version V, send
`shippedIn: {version: V, evidence: <the git ancestry you checked>}` on the abort: the release records
the roster as shipped in V and closes each issue. Without it each roster issue is held for the agent
and the unattended sweep will not re-cut them.

Hand over what you found and take nothing away. A judgement somebody else earned against an earlier
reading stays theirs; this run does not unearn it on its way past, and a run that thinks it should be
unearned says so in the account and leaves the deciding to whoever owns that judgement.
