# The ladder — three rungs, and why every doubtful reading resolves upward

`plugin/src/ladder.mjs` answers one question: which rung of the contract's ladder an issue is on.
`forge guide contract` says what each rung is for and what none of them may buy. This file carries
the one rule that runs through every function there and would otherwise be six comments saying it
six ways.

## The rule

**Where the reading is doubtful, the answer is the rung that owes more.** Every input this module
can be unsure about resolves upward, and the argument is the same each time: being wrong upward
costs a run a payload it did not need to write, and being wrong downward costs the record something
nobody established. The first is a round; the second is a status that claims what no one checked.

Where it applies, and what each case would have done read the other way:

| The doubt | Resolved | Read downward it would have |
|---|---|---|
| a description carrying two marks | the highest of them | let whichever the reader found first decide, so `Size: fix.` above `Size: trivial.` is a trivial and the same body reordered is a fix |
| a comment page the tracker cut | `feature`, whatever the mark says | lose a re-size the cut hid, shrinking a shortfall every other check can only grow |
| a correction naming a pair | only where the pair climbs | let `feature -> fix` raise a trivial to a fix, reading where it points and never where it came from |
| several climbs on one page | the highest | take the newest, so a plan correction written after a re-size erases it (ISS-161) |
| a word the ladder has not got | the height of the lowest rung, never negative | index off the end of the table and answer with nothing |
| a run's transcript naming several rungs | the largest among them | file a batch under its cheapest member, so every rung looks better the more work is batched onto it |

## What the rule is not

It is not a licence to escalate. The rungs are claimed by meaning — one tree and nothing a person
sees, one behaviour and its replacement, or everything else — and that claim is the author's. This
rule decides only what to do when the *reading* is ambiguous, never when the claim is merely small.

Nor does it reach the ceiling. `CEILINGS` is arithmetic the ship prints after the judging, and it
refuses nothing: by then a refusal would have nothing left to protect, and the correction is the
run's to write.
