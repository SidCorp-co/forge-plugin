# `forge next --graph` — the two stores of an edge, and what a landing frees

An edge lives in two places and neither proves the other: the tracker holds one store, and an
issue's body claims edges in prose. So the graph reads the store — the same read the ranking makes —
and lists what only prose says under a heading of its own. A verb of its own printed the prose half
for eleven releases and said in its own last line that no edge route reached it from there; the
route exists now, on the issue itself, so the reading and the claim print side by side and a reader
can see which is which.

**Only the edge orders a dispatch.** A sentence in a body gates nothing, which is why the two
headings are not one list: a reader who cannot tell them apart has been told the wrong thing about
both. A claim only one of the two issues makes is printed as one-sided rather than reconciled away —
the disagreement is the finding.

## What the marker sentence had to be

Only the marker sentence counts, and its trailing period separates the claim from prose about the
claim: ISS-11 says "those four edges are recorded here" mid-row about a different set. Measured
2026-08-27, "Blocked by" and "blocks the" each returned a strict subset of it. A phrase is ranked
against *every* issue, because an issue can be named as a dependent without saying anything itself,
and it is resolved by word overlap over a floor of two, so a vague phrase belongs to nobody rather
than to the nearest title. What a body
has to say for this reader to see it at all belongs where the run that writes the body reads:
`plugin/guides/skills/forge/references/dependencies.md`, which also carries the per-tracker override.

One line each, ASCII, and never a drawn shape: on this tracker's nine edges, 595 bytes and 19 arrows
became 180 bytes and none — a box-drawing tree is fewer characters and more tokens. A literal NUL in
the source once made git read the whole file as binary: no diff, no blame, no `git grep`.

Narrowed to one issue, every edge read gets its line. Over a backlog only the ones that order a
dispatch do and the remainder is a count, because the answer a reader came for is what is held up,
and a hundred expired and `relates` edges in front of it is the same page with the answer buried.

## The reading is bounded, and says so

Every edge in the store would be one `get` per issue on the backlog, which is the 503 the call
budget records. So the reading is the takeable set first, capped at `readCap`, and the tail line
says how much of the backlog it covered: an edge on an issue outside that reading is not there, and
saying so is cheaper than a graph that looks whole and is not. Narrowed to one issue it reads that
issue alone.

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

The tracker answers the ordering on the edge itself: the flow reads `gatesDispatch` with `kind`
behind it. Reading a key off the wrong field of that edge loses every relation silently — the
dependency vanishes, the candidate stays eligible, and the count of relations seen stays zero, so
nothing even discloses it. A `relates` edge orders nothing, so it is answered under a list of its
own rather than among the orderings where every reader had to filter it out again.

A dependency phrase that matched no title is evidence that failed to resolve, not an absence. It
leaves its own issue out with the phrase quoted, and the tail line counts them; the graph is where
all of them, in both directions, are printed.

The call budget the ranking itself is bounded by, and the one source of a complexity:
[`next`](next.md).
