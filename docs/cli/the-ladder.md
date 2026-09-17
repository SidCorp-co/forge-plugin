# The ladder — three rungs, and why every doubtful reading resolves upward

`plugin/src/ladder.mjs` answers one question: which rung of the contract's ladder an issue is on.
`forge guide contract` says what each rung is for and what none of them may buy. This file carries the
one rule that runs through every function there and would otherwise be six comments saying it six ways.
A rung read out of prose rather than out of the field is [its own topic](the-rung-in-text.md).

## One source, and why it is the field

A rung is claimed once, by the `complexity` the tracker holds. The body claimed one too until ISS-701,
and two sources for one switch is a precedence rule, a report about which of them lost, and an undo that
only half works. So the `Size:` line is read by nothing: bodies already carrying one are not edited, the
line is prose now claiming nothing, and `forge issue ISS-nn --set complexity=<value> --why <w>` is how
an issue only ever marked in its body gets the field.

The rung is also the height the lane is printed at, so it reaches `forge claim` and `forge resume` as
well as the contract, and a correction that climbs changes what all three say is owed ahead. The two
largest complexities earn a question rather than a payload — one change, or several? What a rung owes
stays the contract's; a report that grew a demand of its own would be a second ladder.

**Two things this module reads outlive the words they were written in, so it reads two spellings and
writes one.** `Size:` for `Rung:` on a climb, `tier:` for `rung:` on a stamp, and the same pair in a
window stored at an eval mark. A record written last month still reads as it did, nothing emits the
retired word, and each retired spelling lives in one declaration whose name says it is retired — the
only shape `plugin/src/checks/tracker-names.mjs` lets an alias stand in.

## The rule

**Where the reading is doubtful, the answer is the rung that owes more.** Being wrong upward costs a run
a payload it did not need to write; being wrong downward costs the record something nobody established.
The first is a round, the second a status claiming what no one checked.

Where it applies, and what each case would have done read the other way:

| The doubt | Resolved | Read downward it would have |
|---|---|---|
| an issue holding no complexity | `feature`, the rung that owes most | read an unset field as the rung that owes least, so an issue nobody judged is the cheapest one on the backlog |
| a comment page the tracker cut | `feature`, whatever the field says | lose a climb the cut hid, shrinking a shortfall every other check can only grow |
| a correction naming a pair | only where the pair climbs | let `feature -> fix` raise a trivial to a fix, reading where it points and never where it came from |
| several climbs on one page | the highest | take the newest, so a plan correction written after a climb erases it (ISS-161) |
| a word the ladder has not got | the height of the lowest rung, never negative | index off the end of the table and answer with nothing |
| a complexity the table has not got | no claim at all, so the rung is a `feature` | invent a rung for a value nobody mapped, and read it as the one that owes least |
| a run's transcript naming several rungs | the largest among them | file a batch under its cheapest member, so every rung looks better the more work is batched onto it |
| a plan declaring one name twice | `yes`, wherever outside a code span it stands | read the first, so `no` above `yes` waives a payload the plan explicitly declared, and the same two lines reordered do not |

## What the rule is not

It is not a licence to escalate. The rungs are claimed by meaning — one tree and nothing a person sees,
one behaviour and its replacement, or everything else — and that claim is the author's. This rule decides
what to do when the *reading* is ambiguous, never when the claim is merely small.

Urgency is not an input. Priority is the order `forge next` ranks by and it reaches no rung, so there is
no rung for a hotfix: the way to make an urgent change cheap is to make it small.

Nor does it reach the ceiling. `CEILINGS` is arithmetic `tools/run.mjs` prints after the judging and it
refuses nothing — by then a refusal would have nothing left to protect, and the correction is the run's
to write. Being advisory is why every doubtful read there is silent rather than loud, and why it is
contained whole: an advisory number is not worth the lines that say what landed. What it counts is the
change and not the push — the range ends at the sha the change landed as, never at HEAD, which by that
step carries the version commit the same release just made. The rung that print uses is asked for and never worked out there: `forge resume <ref> --json`
carries the one the lane reads off the record's corrections, so ship and tracker cannot answer
differently about one issue. It came off the report page until ISS-1012, where a verdict's prose quoting
the climb form loosened the rung on a record holding no correction at all.
