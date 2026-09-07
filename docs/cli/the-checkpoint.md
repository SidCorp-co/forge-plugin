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
promotion. What tells the two apart on a resume is the release the checkpoint names — one carrying a
release is past its own push, so what is owed there is the status and never a second candidate — and
not the route read again: a project that changed its policy mid-landing would otherwise resume into
the other route's step, and the release is a fact about this landing where the route is not.

Where nothing asks for a second judge the state is not written at all and the landing runs through.

## The turn is handed back, never abandoned

`--judged` is the one route out of the judge's state, and without it that state is where a landing
goes to die: the judge takes the turn, writes its verdicts as any run does, and says the turn is
over. What those verdicts have to carry — a judge that is not the builder, and a citation of the
deployment identity the checkpoint holds — is the contract's business at `tested` and is not
re-judged here, because a judge this claim refused could neither hand back nor be replaced.

The hand-back names the judge, because the lease it wrote under is still live and the landing has to
be able to take it: that is a hole in the guard refusing a live lease, so it is cut at that one state
and spent by the take that uses it, the judge's own included. Left set, a judge that went on to land
its own change would hold a lander's lease any third run could take.

A base or a branch head that moved after those verdicts voids them, and the landing names the numbers
rather than describing the loss: whoever judges again is owed the list.

## What a state may not do

Nothing writes a state the table does not offer as its successor, and the move is checked against the
field as it reads at the moment of the write rather than against what the caller last read. One state
is terminal, and no turn may take it: it says the landing is over. It is written on the status the
record earned and not on the attempt to move one, because a checkpoint closed over a status nothing
earned would leave the issue reachable by no route at all.

A state whose successor nothing writes is the same defect wearing a table's clothes — the table's own
reachability walk cannot see it — so every state is asked for by name in the sources that write one.
