# `record verdict` — the judge's write

**Only a verdict goes up past a lease the writer does not hold.** The lease guards the writes that
replace something — a field, a status, the lease itself — so that two runs never write over each
other, and a verdict replaces nothing: it is a comment and the files it cites. It is also the one
record that has to come from somebody other than the run holding the issue. Under the old rule a judge
dispatched while its dispatcher held the lease could record nothing of its judgement, and the routes
left were a lease shortened and waited out, or a `--stopped` asserting something false (ISS-1494).

So a lone verdict meeting a lease that is another run's is posted under the caller's own id, and the
field holding that lease is left byte for byte as it was. Nothing is renewed or taken, and no status
moves, because a status is a write the lease covers: the move the verdict earns is named for the holder to make. A verdict riding
beside another kind is that kind's write, and meets that kind's refusal.

**The id has to be one the caller chose**, because a verdict under an id handed down from the
dispatching session, or kept by the machine across sessions, cannot say which run judged. That
condition does not tell a builder under a new id from a judge it dispatched, which share a process;
whether the judge was the builder is the contract's question at `testing`, and is asked there, and
asked again at the write where the project wants a second judge.

**Where a project wants a second judge, the write refuses a verdict whose writer the rung will never
count**: one under an inherited id, and one under the builder's own. A verdict is only additive on
the thread. The page reads the latest one on each criterion, so a verdict written under such an id
takes the place of a judge's that stood there and leaves a criterion nothing counts, which is what
a dispatching master writing under its inherited id did seven times in one day on another project
(ISS-2206). A checkpoint that cannot name its builder, or a citation that misses the deployment, is
a shortfall a later write can cure, so a verdict short in either is still written and the rung says
what it is owed.

**The write asks one more thing there: what the judge exercised.** A commit says which code was read
and never that it was running, and forge-core weighs a verdict naming only a commit as unwitnessed.
So where the landing checkpoint names a deployment, a verdict saying somebody looked owes the whole
id the judge read back off it on `--runtime`, and a judge that read none writes `skipped` saying
what it lacked rather than a commit standing in. Asked only there: where the builder judges, or
nothing records a deployment, there is no runtime a judge was sent to, and owing one would hold
every such issue for ever, which is the defect ISS-1788 removed. A runtime the checkpoint stops
naming leaves its verdict superseded, and every rung from `testing` to the close names that
criterion and why, whoever judges; only the checkpoint moves that reading, never a verification, a
finding or prose (ISS-2279).

**A judge learns this before it judges, not at the write.** The read of what an issue owes says,
to a caller that does not hold the lease, whether its verdict would go up and under which id.
