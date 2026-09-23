# stats — the waves

**A run is measured and the dispatcher that sent it was not.** `stats eval` says whether the last
fifty runs got cheaper, and nothing said whether the wave that chose, briefed and landed them did,
or how often it got those steps wrong. The mistakes a dispatcher makes are the costly kind: a branch
handed back at landing is a builder turn and a second gate, and a run replaced where it could have
resumed is every call the first one made. `forge stats waves` and `forge stats eval --waves` count
those off what a wave leaves behind, so G-11 can be judged at the level that decides how many runs
there are at all.

## Records only

Everything counted is on a record: the wave and fold records on the headline, each member's lease
history, and the dispatcher's own calls. Nothing is inferred from prose — a fold section that says
"one run was handed back" is a report about a count, and it is the count that is taken.

That rules out three things the dispatch method names as mistakes and no record carries: the
candidates read before the wave chose, a ranking the dispatcher overrode, and a brief sent wrong and
sent again. Each would need a record kind of its own before it could be counted, and counting them
off the transcript's wording instead is the hand profile this verb exists to stop being.

## Whose session is read

The dispatcher is the session itself, not one of the runs it sent, so its file is the top-level one
under the project's transcript root and never a subagent's. A subagent that wrote a wave record —
a run dispatching a batch of its own — is a run, and its waves belong to the corpus `stats runs`
reads.

The headlines are the ones those sessions wrote a `forge record wave` or `forge record fold` against,
counted only where the call was answered and not refused. A refused write named an issue that holds
no record, and reading its page would cost a request to learn that.

## Why a hand-back is a lower bound where a history is full

A hand-back is a take of the member's lease at which its landing read `head-owed` or `builder-owed`.
The lease keeps only its last twelve rows, so a member taken often after the wave began has lost the
rows that would say whether it was handed back early in it. Where the kept rows no longer reach the
wave's start, the figure prints as *at least*, naming the member — an exact-looking count that
silently lost its front is the one figure this reading may not give.

## What separates two windows

The plugin copy each wave's dispatcher ran when the wave began, the same dimension the run eval
separates its windows by, because the dispatch method is served by the copy and a change to it is a
change of copy. Refusals are listed per wave and given no direction: how often a gate fires is not a
measure (BRD §5), only where one fired.

## When it is run

At every tenth fold, the fold write itself prints the line naming `forge stats eval --waves`. The
count is the project's answered fold writes in its dispatcher sessions and the write being made,
which is still running and so in no transcript as answered yet. No reading is held for waves, so the
two anchors the run eval takes are refused beside `--waves` rather than ignored.
