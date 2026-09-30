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
whether the judge was the builder is the contract's question at `testing`, and is asked there.

**A judge learns this before it judges, not at the write.** The read of what an issue owes says,
to a caller that does not hold the lease, whether its verdict would go up and under which id.
