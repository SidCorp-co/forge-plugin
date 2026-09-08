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

## The turn is handed back, never abandoned

Two states name a turn that is not the lander's, and each has one route out, a flag of the claim the
run holding it makes: without one, that state is where a landing goes to die.

`--judged` is the judge's: it takes the turn, writes its verdicts as any run does, and says the turn
is over. What those verdicts have to carry — a judge that is not the builder, and a citation of the
deployment identity the checkpoint holds — is the contract's business at `tested` and is not
re-judged here, because a judge this claim refused could neither hand back nor be replaced.

`--reconciled <sha>` is the builder's, and the sha is what that state is for: the run is asked which
candidate it read, and the candidate the checkpoint names is what proves the reading rather than the
run's word for it. Seven digits or forty, because seven is what the hand-back prints; the checkpoint's own string
is what is stored, since the promotion compares that. A reconciliation of some other candidate is
refused at the write rather than at the promotion, and the same independence `--judged` is held to
holds here: at that state the turn is the builder the checkpoint names, and an id a whole wave carries
is not proof of being it.

Where the builder is gone its dead lease is any run's, and the run that takes the turn there may make
that write too. Its own take is what says so — the claim history's row, naming the run at that state
— because a successor holds a live lease from the moment it takes and the lease alone cannot tell it
from the lander that wrote the hand-back under a lease it already held. The row read is the holder's
own latest and no earlier one, because the history outlives both the holder and the state: a run that
took the turn and lost the lease is any other run again, and one that has since taken another turn is
at that one.

The lease such a run leaves is spent where the judge's is, one state along: at `reconciled` the
lander's turn comes back at once rather than after a run whose own turn ended with that write. Nothing
is marked and nothing has to be cleared: the take that spends the row is the same take that writes a
newer one, so the lease the lander then holds — that run's own, or the successor's if it goes on to
land — is an ordinary lander's, which a third run may not take.

The hand-back names the judge, because the lease it wrote under is still live and the landing has to
be able to take it: that is a hole in the guard refusing a live lease, so it is cut at that one state
and spent by the take that uses it, the judge's own included. Left set, a judge that went on to land
its own change would hold a lander's lease any third run could take.

A base or a branch head that moved after those verdicts voids them, and the landing names the numbers
rather than describing the loss: whoever judges again is owed the list. The numbers are the verdicts
taken at the identity being given up, and not every verdict a promotion would refuse — one citing
some third head was void before this landing and is nothing this void takes. Whether a verdict still
standing cites what is running is read per verdict at `tested`, and is not a second list here.

## What a state may not do

Nothing writes a state the table does not offer as its successor, and the move is checked against the
field as it reads at the moment of the write rather than against what the caller last read. One state
is terminal, and no turn may take it: it says the landing is over. It is written on the status the
record earned and not on the attempt to move one, because a checkpoint closed over a status nothing
earned would leave the issue reachable by no route at all.

A state whose successor nothing writes is the same defect wearing a table's clothes — the table's own
reachability walk cannot see it — so the sources that write one are read for every state, twice. Once
for the state written at all, which catches a row nobody writes; and once for a row whose turn is a
run's own, whose every successor has to be written by that run's verb, because a turn the holder
cannot leave is a landing parked for good. Both readings are of the source and of the one spelling a
state is written in, so a write spelled otherwise is refused by them rather than missed.
