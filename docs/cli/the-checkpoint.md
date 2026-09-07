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
reachability walk cannot see it — so every state is asked for by name in the sources that write one.
That catches a row nobody writes at all and not a row whose turn holder has no command for it, which
is a state its own turn cannot leave: `builder-owed` is one, and ISS-726 carries both the reading
that would fail on it and the route out it is missing.
