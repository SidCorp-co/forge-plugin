# `advance` — the ladder is core's

**Twenty-five moves were refused for a name the tracker had retired.** In the Agenfold sessions of
2026-10-30/31 the flow still walked `confirmed`, `developed` and `testing`, rungs core answers
`ISSUE_STATUS_LEGACY`, and the runs gave up on `forge advance` for hand-written REST. So the ladder
is core's issue machine and nothing beside it:

`open → in_progress:plan → approved → in_progress:build → in_progress:test → in_progress:release → awaiting_release`

A place inside `in_progress` is that status at a work step. It is written as the status and then the
step, and a row read back is named by its place again, so the entry checks read what the move wrote.
Every move up the ladder that changes the status is an edge core holds, which a case pins against a
copy of the contract.

**A move is read against what core serves before it is sent.** The issue's standing names the moves
core serves from where it stands (`moves`), and a move up the ladder that is not among them is refused
here, naming the ones that are. A standing that cannot be read leaves the move to core's own
transition, which refuses it by name either way: the read is the earlier answer, never the only one.
A park and a set carry their own payload and are judged whole by core.

**The ladder ends at `awaiting_release`, and offers no `closed`.** The close from there is the
release's (`CLOSE_ONLY_BY_RELEASE`), so `--owed` and the plain advance answer with the record that
makes it, `forge release-batch record`, and with the reopen that sends work back. The word `close`
typed as a command is a route: it prints that record rather than moving anything.

**A retired name is never sent.** The transport refuses a status core does not hold before the
request, naming the place that took it over; `--set` and `--to` refuse one the same way. A park record
written before the ladder was core's names the place it left by its old rung, the same place under
another name, and is read as that place.

**Which criteria carry a verdict is core's count as well as the thread's.** A verdict written through
core's verdict route (`POST /api/issues/:id/verdicts`) posts no comment, so the owed list also reads
core's criteria (`GET /api/issues/:id/criteria`, each criterion's `latest`, the read whose weighing
core's gate decides by): a criterion either source judged owes none. A criterion core routes to the
review (`judge: review`, a code property) is no verdict's to discharge, and core refuses one on it
(`VERDICT_JUDGED_BY_REVIEW`): the list names it as the review's, owed by a run declared `--role
reviewer` through core's review, `forge record review --head`. Where that read is refused, the list is the thread's and says so
beneath it.
