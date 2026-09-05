# What makes a review due

The spine's description names the two triggers so a session can recognise one. Here is what each is
arithmetic over:

- **the ceiling** — a limit on the whole run, fixed by the project in advance, now exceeded
- **the drift** — the whole run against the figure the previous review recorded, a quarter higher

Neither is anybody's patience. A gate that irritates one developer on a bad afternoon is owed
nothing, and one that has doubled while everybody quietly got used to it is owed a review — which
is the reverse of what irritation reports.

## Why a ceiling, and why it is the project's

It is not a performance target. It answers a product question: how long may a run wait before the
waiting costs more than the risk of checking less? A project shipping to people answers differently
from one shipping to a staging host, so this plugin holds no number and should not.

A project that has fixed none has that as the review's first finding, and the review proposes a
figure out of what it measured rather than out of the air. Frequency belongs in that proposal — a
pipeline spent once a day and one spent forty times in a session justify limits an order of
magnitude apart.

## Why drift matters as well

A ceiling catches a gate that is already too slow. Drift catches the one on its way there, which is
every gate: nobody adds a minute, everybody adds four seconds. A quarter is enough to be a decision
somebody made, and little enough to still be cheap to undo.

## What the arithmetic reads

Where the harness keeps a duration for each run it passes, that series is what the trigger reads —
but a series is not a baseline. Say which of it you are comparing against, and reduce it to one
number first: the figure the previous review recorded, or the median of the runs taken under
comparable conditions since then. Never the fastest, and never the single most recent, which is one
sample of a noisy quantity. Drift is then a ratio rather than a difference — `current / baseline`,
firing at 1.25 — because a quarter of a three-minute gate and a quarter of an hour-long one are not
the same amount of anything.

Where it keeps only pass or fail there is no series, and the figure the previous review wrote down
is all there is. Say which of the two you read: a comparison against one prior figure is a weaker
claim than one against a series, and a reader who is not told cannot tell them apart.

Where neither exists, this review's own measurement becomes the first baseline. Recording it
somewhere the next review can find it is part of *this* review and not a follow-up — an unrecorded
measurement leaves the next trigger just as unreadable, and the review after that starts from
nothing for exactly the reason this one did.

## The run it happens in

A gate review is an issue like any other and earns no shortcut by being about the harness: its own
issue, its own worktree so the timing is not taken against somebody else's uncommitted work, a
record of what it found, and a second reading of its commit before it ships.

The one thing particular to it is what it moves on the way out. A code review ends by moving the
mark saying how much has been read; this one ends by writing the new whole-run figure where the
arithmetic above will look for it. A run that ships a quicker gate and records no figure has not
finished — it has handed its successor the same blank page it was handed.
