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

A fixed window is wrong two ways. It truncates the row a body would have promoted — twenty-five
tied issues and a twenty-sixth declaring a fix size, and the winner is never read. And a window
every filter drops reports nothing eligible while eligible issues sit below it, because eligibility
is judged over what was read. Reading in
passes and re-judging the whole read set answers both.

The bound is over the candidates the *printing* can need rather than the batches asked for: a batch
takes members out of the eligible list, so five batches can consume five times the batch cap before
the last head is settled.

And the bound has a hole that is disclosed rather than closed, which is why the answer carries two
words and not one. A body may declare a blocking relation, and that raises whatever it names by
three points for every issue in the chain behind it — an amount no size-only bound covers. Where one
has already been met the read keeps going rather than pretending the next body holds none. What
nothing can cover is a relation in a body nobody opened, so *bounded* says the size bound held over
what is unread and *settled* says every candidate was read. They certify different things and one
word for both would claim the stronger of the two. On this tracker no issue's relations came back
filled at all, so the first has always held here and the second has not.

`readCap` is the budget the 503 above set, and where it bites the answer says so on the error stream
and in a field of the machine-readable one both — an order a budget cut is not one whatever
dispatches on it may treat as bounded, and a notice only the human form carries hides exactly that.

## What a landing frees, and what it only reaches

`unblocks ISS-a (eligible after this lands)` is a claim, so it is made only about an issue this one
blocks and that nothing else still holding blocks. An issue with a second blocker is named with it;
an issue further down the chain waits for the wave in front of it and is printed behind them rather
than promised. Claiming eligibility for everything the chain reaches is false in both of those
cases.

What ends a blocker is not this verb's to decide. `forge advance` already refuses a move past a
blocker below `developed`, and the flow exports that answer, so a blocker here is exactly one the
transition would refuse on — a rank that invented a stricter floor would name a wall no verb
enforces, and one that invented a looser floor would send a run at an issue it cannot advance. That
also settles what a chain walks through: an issue being worked or waiting on a person still holds up
what waits on it, and reading the *dispatch* set as the blocker set instead loses the whole chain
through anything in flight — the issues most likely to be mid-chain being exactly the ones being
worked. Both the score that orders the reading and the score that prints read that same set, because
a candidate the first undercounts is one the bound then keeps from ever being read.

The tracker answers the ordering on the edge itself: `relations.blockedBy` carries mentions beside
orderings, and the flow reads `gatesDispatch` with `kind` behind it. Reading a key off the wrong
field of that edge loses every relation silently — the dependency vanishes, the candidate stays
eligible, and the count of relations seen stays zero, so nothing even discloses it.

A dependency phrase that matched no title is evidence that failed to resolve, not an absence. It
leaves its own issue out with the phrase quoted, and the tail line counts them; `forge deps` is
where all of them, in both directions, are printed.

The measured cost of the whole verb against this backlog is about twenty-eight seconds: four for the
two walks it issues together, three for the past-run corpus on disk, and the rest for the bodies and
the two memory searches each printed head is measured with.

A head is searched when it becomes one, never before: choosing the heads up front and searching them
afterwards leaves the issue an earlier batch promoted with no answer of its own, and a relation only
the search can see goes unfound. That would make every search a round of its own, which measured
fifty-nine seconds, so the heads a batch does not move are asked for together and only a head a
batch promoted costs a round — the rare case paying for itself instead of every case paying for it.

## The band has two sources, and the row says which decided

The listing carries the size field on every row, and the body's `Size:` line is the other source. The
row names which decided, because a band the body claimed and a band the tracker gave score the same
and mean different things.

**Which decides is the ladder's, not this verb's.** `plugin/src/ladder.mjs` resolves both upward —
the higher rung wins, neither source lowering a rung the other claimed — so a body marked
`Size: feature.` under a field saying `xs` bands as a feature here, as `forge advance --owed` holds
the run to one (ISS-394). The width survives: a rung is three values and a band five, so an unbeaten
field keeps its own band and `l` and `xl` score apart; a body that outranked it takes the band to the
canonical one for the rung it won.

## Where the module reading stops, and why it is not the repository

Relatedness by module is the tree a body names, matched against the trees another body names, one
path being a prefix of the other. It is deliberately *not* an import graph: this plugin runs in
repositories it cannot see, so a verb that inferred which trees import which would be reading a
layout out of a checkout it may not be standing in — and, standing in the wrong one, would answer
confidently about somebody else's tree. Two issues in trees that import each other are related by
the relation or by the search, both of which the tracker answers for, or they are not related here.

## The restart signal is the ship's set, not a tree

`restart` beside a candidate answers one question — can an open session pick this file up — and the
ship answers it already, at the step that names what a landing owes a restart for. So the rank
spends `freezesSession` rather than naming trees of its own. A second table is a second answer to
one question, and nothing goes red when the two disagree: `plugin/hooks/` was that second answer,
marking every gate file, from minutes after the landing that made a gate reach an open session
without a restart at all.

The consequence to expect from reading the set rather than the tree: a file *outside* `plugin/hooks/`
can earn the mark, because what freezes a session is the registration and the modules it loads at
start, not the directory a file sits in.

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
