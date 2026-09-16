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

That is why three rows offer two successors and why `judged` is reachable from either side of a
promotion. What tells the two apart on a resume is the sha the checkpoint names as the one it meant
to push — only the push step writes one and a void gives it up, so a checkpoint carrying one is past
its own push and what is owed there is the status, never a second candidate. Not the route read
again: a project that changed its policy mid-landing would otherwise resume into the other route's
step, and what this landing did is a fact about it where the route is not.

Where nothing asks for a second judge the state is not written at all and the landing runs through.

## A release finishes the checkpoint whatever route it took

`ready` says a lander owes this branch its first step, so it has to stop being true the moment the
branch is landed and released — by whichever of the two routes did it. The batch landing writes
`done` at the end of its own walk. A run that lands its own change writes it from the release's last
step, over the branch that release landed and over no other, having read which issues the tree
answers for off the id its workspace was minted under. Left unwritten, the field outlives the release
it describes and the next landing that asks what is ready is told this branch is, which buys a gate,
a version and a push for a merge that changes nothing.

Neither route reads that write back as a status. `done` says no turn of the landing is left; how far
up the ladder the record has carried the issue is the record's own answer, and a release that owes a
person an act leaves the issue standing at the rung it earned with the checkpoint finished all the
same.

## A candidate is a fact about the branches on it

The landing takes the branches it is given as one candidate: the pin merged with the first head,
that commit with the second, and so on in the order the keys were named. Every link is built with
its dates, identity, message and encoding fixed, so the sha is a function of the pin and that order
alone — which is what lets a second landing over the same set rebuild that commit and find its
reconciliations still true.

That is also what a set may not hold. A checkpoint carrying the sha it meant to push is past a
candidate and every step left on it is its own, so it is finished alone and before any set is formed — a landing pushing something else past it would void a release whose gate is paid for. A
moved path holds a reconciliation its builder took at the candidate of one branch alone, which a
chain of several never equals. A deployment holds a judge's turn spent on one. The three states left
all owe the first step, which is why one machine can drive a list, and why a set is refused where an
independent judge is owed before the merge: the candidate a turn is handed over is a fact about a
membership nothing rebuilds once half of it has come back judged.

That sha is written onto every member before the push, one document each, so a death inside those
writes leaves a member out of a release that carries its change. Neither names the other: the release
holds that member's judged head, so its candidate, gate, version and install are paid for, and what
is left is the mark at that commit and the statuses its record earns. A release the branch lacks, or
that nobody installed, carries nobody: that member waits for the landing which owes it.

So the two readings taken at a candidate part company when the membership moves. A reconciliation the
landing wrote itself is void, said with the verdicts it takes, and made again at the candidate this
set does build. A builder's is refused instead: that one is work somebody did, and none of the
landing's to write over.

A pin that moved is not that event. The membership is unchanged there and only the base has grown,
so what the landing rebuilds is a second sha over the same two commits — and a builder's answer, an
answer about that change's own paths and about nothing else, is as true of the new candidate as of
the old wherever those paths read the same in both. What stales it is the merge's content, not the
sha it was filed under, so the sha is re-keyed and the branch is not sent back to answer what it has
answered. It is carried only where the candidate rebuilt from the pin the checkpoint itself names
comes back as the sha that answer names: a reading this checkout cannot reproduce is one it cannot
vouch for, and that is the whole of what stops a builder waving through a candidate it never saw.
The readings taken over the candidate as a whole — the judge's turn and the release it was spent on —
go with the pin whatever the paths do.

A branch joins the chain only where its link moves neither its own paths nor a sibling's. One the pin
alone moved goes back to its builder against the merge of that branch alone — a sha a later landing
rebuilds. One only a sibling moved leaves the set owing nobody anything and lands after it: there
that sibling is the base, and its builder is asked in the ordinary way. A conflict against the pin
parks the issue, a park being a claim about the base; against a sibling it only drops it.

Two changes green apart and red together are a fact about the pair, so no subset is searched for —
what makes two changes incompatible is not in the paths they touch, and a landing that parked
whichever branch came second would park an innocent one half the time. Every reading taken at that
candidate is void and the branches are landed one at a time against the base as it moves, so the one
that fails there fails on its own account.
The runs that bounds is one for the candidate and one per branch, named before the first is spent.

Whose turn each state names and the three routes a turn is handed back by: [`the-turn.md`](the-turn.md).
Who takes a turn its holder left, and what a state may not do: [`the-takeover.md`](the-takeover.md).
