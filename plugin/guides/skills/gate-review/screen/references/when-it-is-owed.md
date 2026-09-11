# What makes a review due

Two triggers, each arithmetic and neither anybody's patience:

- **the ceiling**: a limit on the whole run, fixed by the project in advance, now exceeded
- **the drift**: the whole run against the figure the previous review recorded, a quarter higher

## The ceiling is the project's

It answers how long a run may wait before the waiting costs more than checking less, and a project
shipping to people answers differently from one shipping to a staging host, so this plugin holds no
number. A project that has fixed none has that as the review's first finding, and the review
proposes a figure from what it measured. Frequency belongs in the proposal: a pipeline spent once a
day and one spent forty times a session justify limits an order of magnitude apart.

## What the drift arithmetic reads

Where the harness keeps a duration for each run it passes, reduce the series to one number first:
the figure the previous review recorded, or the median of comparable runs since. Never the fastest,
never the single most recent. Drift is a ratio, `current / baseline`, firing at `1.25`.

Where the harness keeps only pass or fail, the figure the previous review wrote down is all there is.
Say which of the two you read.

Where neither exists, this review's own measurement becomes the first baseline, recorded where the
next review will look, as part of *this* review.

## The run it happens in

A gate review is an issue like any other: its own issue, its own worktree so the timing is not taken
against somebody else's uncommitted work, a record of what it found, a second reading of its commit
before it ships.

What is particular to it is what it moves on the way out: the new whole-run figure, written where
the arithmetic above will look for it. A run that ships a quicker gate and records no figure has not
finished.
