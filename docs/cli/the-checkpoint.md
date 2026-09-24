# the checkpoint — what a build ready to land leaves, and whose turn each state names

The second object in the issue's session field, beside the lease `claim` writes: the branch, the
base, the head the review was taken at, the paths the change touched, and a state saying whose turn
it is. `forge claim --ready` writes it, `forge resume` reads it, and `--take` is how the turn it
names changes hands. Why the lease it sits next to promises what it does: [`claim.md`](claim.md).

## Both routes are in one table, and the project decides which is walked

A default branch that deploys production on its own is judged before the push, because there the push
*is* the deploy: the landing builds the candidate, gates it, versions it and stops with the
candidate's own sha as the deployment identity, and the promotion waits on the judgement. Every other
project is judged after the merge, on the release the branch now carries, so the same state sits
below the mark instead.

That is why the rows around the judgement offer one successor per route and why `judged` is
reachable from either side of a promotion. What tells the two apart on a resume is the sha the
checkpoint names as the one it meant to push — only the push step writes one and a void gives it up,
so a checkpoint carrying one is past its own push and what is owed there is the status, never a
second candidate. Not the route read again: a project that changed its policy mid-landing would
otherwise resume into the other route's step, and what this landing did is a fact about it where the
route is not.

Where nothing asks for a second judge the state is not written at all and the landing runs through.

## A release finishes the checkpoint whatever route it took

`ready` says a lander owes this branch its first step, so it has to stop being true the moment the
branch is landed and released — by whichever of the two routes did it. The batch landing writes
`done` at the end of its own walk. A run that lands its own change writes it from the release's last
step, over the branch that release landed and over no other, having read which issues the tree
answers for off the id its workspace was minted under. Left unwritten, the field outlives the release
it describes and the next landing that asks what is ready is told this branch is, which buys a gate,
a version and a push for a merge that changes nothing.

Neither of those reaches back. A release made before that step shipped left its checkpoint standing,
and so does one whose workspace is gone by the time anybody reads it: each answers for the tree it
ran in. `forge claim --landed` is the third route and it asks the repository instead of the caller —
the branch a change lands on either carries the head the checkpoint was written at or it does not,
and where it does there is nothing left for a lander to do. Nothing is judged there, so no turn is
taken and no independence is read. It builds nothing, gates nothing and pushes nothing, which is the
point: what stands between such a checkpoint and the end of its landing
is a fact about the repository, and buying a release to establish it is paying for work already done.

Which branch that is, the project declares. Where it has, that declaration is what the ancestry is
read against and the ref this checkout recorded as the remote's own is read nowhere — a release that
promotes moves code to a second branch, and reading a landing against that one leaves the checkpoint
at `ready` until after the release, which is after the verdicts on the change are owed. Where the
project has been read and declares none, the recorded ref answers as it always did. Where the
project's configuration did not read at all, the reading refuses rather than choosing between them:
an unread declaration is not a declared absence, and the write this licenses cannot be taken back.
Two sources for one reading are a precedence, so every line the reading produces says which of them
named the branch, a refusal and the line reporting a landing ended alike.

That reading refuses what it cannot settle, which is the opposite of the branch reading a hand-back
is held to one file along. There a refusal leaves a builder with a branch that was right and no write
left to make, so everything but a proof of the bad case goes through. Here a pass ends the landing,
so a shallow history, an object the store will not read, a ref that resolves to nothing, a project
whose declaration nobody could read and a call git would not answer each refuse, saying which of them
fell short. The recorded ref is read whole and never as a conventional name that happens to resolve:
a repository carrying both of the usual two would have the ancestry settled against whichever
answered first.

Neither route reads that write back as a status. `done` says no turn of the landing is left; how far
up the ladder the record has carried the issue is the record's own answer, and a release that owes a
person an act leaves the issue standing at the rung it earned with the checkpoint finished all the
same.

`done` is final for the landing that wrote it and for no later one. Once a finding sends the change
back, a second landing of the same issue needs a checkpoint of its own. The record says so: the
issue stands at the reopen, or at a status of the flow below the one a build hands over at. So the
capture at that push writes `ready` over the finished checkpoint, whole, and carries nothing of the
first landing into the second. That record is the license, and the caller's word is not. At a status
past the build the finished checkpoint still refuses the capture, since nothing on the record says
the landing it describes was superseded. A head the first landing already carries is refused
too, since landing it again merges nothing. A reopen moves only the status, so the first landing's
checkpoint stays readable until that capture replaces it.

What the commit a landing builds is, and what a reading taken over it is a fact about: [`the-candidate.md`](the-candidate.md).
What a checkpoint nobody captured may say instead, and the one key a declaration buys: [`the-reconstruction.md`](the-reconstruction.md).
Whose turn each state names and the four routes a turn is handed back by: [`the-turn.md`](the-turn.md).
Who takes a turn its holder left, and what a state may not do: [`the-takeover.md`](the-takeover.md).
