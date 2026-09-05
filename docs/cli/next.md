# `forge next` — the call budget, the two sources of a band, and where the module reading stops

The order this verb prints is arithmetic over what the tracker already holds, and `forge next -h`
prints the table it is arithmetic over. What follows is what neither the table nor the code can
carry: the measurement each shape was set by.

## 171 gets is not a shape a ranking may take

Read on 2026-09-05 against this project's own backlog: 330 issues, 171 of them open. Asking the
tracker for all 171 bodies at once — one `get` per open issue, issued together — came back `503 no
available server` after three backoffs. The walk that lists them costs five pages and about two
seconds; the bodies cost the tracker.

So the score is computed on the browse projection alone, which carries the priority, the category,
the size, the reopen count and the filing date — every weight but one. Bodies are read a pass
at a time, and what stops the reading is not a count but a bound: a body decides the size band and
nothing else about the score, so an unread row can climb by the band's own spread and no further.
The reading stops when the best an unread row could reach cannot beat the last candidate asked for.

A fixed window would have been wrong twice, and both were found in review before this landed. It
truncates the row a body would have promoted — twenty-five tied issues and a twenty-sixth declaring
a fix size, and the winner is never read. And a window every filter drops reports nothing eligible
while eligible issues sit below it, because eligibility is judged over what was read. Reading in
passes and re-judging the whole read set answers both. `readCap` is the budget the 503 above set,
and where it bites the answer says so rather than presenting a short read as a settled order.

The measured cost of the whole verb against this backlog is about twenty-eight seconds: four for the
two walks it issues together, three for the past-run corpus on disk, and the rest for the bodies and
the two memory searches each printed head is measured with.

A head is searched when it becomes one, never before: choosing the heads up front and searching them
afterwards leaves the issue an earlier batch promoted with no answer of its own, and a relation only
the search can see goes unfound. That would make every search a round of its own, which measured
fifty-nine seconds, so the heads a batch does not move are asked for together and only a head a
batch promoted costs a round — the rare case paying for itself instead of every case paying for it.

## The band has two sources, and the row says which decided

`forge_issues` returns the size field on `list` and not on `get`, and its `fields` enum takes only
`description`, `plan`, `acceptanceCriteria`, `sessionContext` and `releaseNotes`. Measured the same
day: 3 of 330 issues carry a value, all three closed. So the band is read off the listing, and where
the listing gives none the body's `Size:` line stands in through the reader `plugin/src/tracker/issue-shape.mjs`
already has. The row names its source, because a band that fell back and a band the tracker gave
score the same and mean different things.

That fallback is this verb's weight and not the ladder's reading of a size, which ISS-317 owns. When
that lands, the band imports it and the second source goes.

## Where the module reading stops, and why it is not the repository

Relatedness by module is the tree a body names, matched against the trees another body names, one
path being a prefix of the other. It is deliberately *not* an import graph: this plugin runs in
repositories it cannot see, so a verb that inferred which trees import which would be reading a
layout out of a checkout it may not be standing in — and, standing in the wrong one, would answer
confidently about somebody else's tree. Two issues in trees that import each other are related by
the relation or by the search, both of which the tracker answers for, or they are not related here.

## What the cost column is silent about

The minutes come from the transcripts the harness keeps, folded by `forge stats runs`'s own corpus
and its own is-this-a-flow-run predicate; only the issue key is read again, off each run's `forge
claim` call. The root is derived from `--project`, defaulting to the working directory exactly as
`forge stats runs` does, and nothing is inferred from the git common directory: a run from a worktree
sees no corpus and prints a dash, which is honest, where reaching for the checkout above would be a
guess about which tree the runs were worked in.

A band no past run landed in falls back to the median over every measured run and says so. A dash
means no corpus at all, and it has to keep meaning that: a band with nothing behind it printing a
dash would read as a harness that keeps no transcripts.

The figure is what a past run took, not what this one will. It is a column beside the score and
enters no total, which is the whole of what "the agent decides" costs the code: the order is advice,
and whoever dispatches records what it did instead.
