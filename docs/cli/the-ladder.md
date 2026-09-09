# The ladder — three rungs, and why every doubtful reading resolves upward

`plugin/src/ladder.mjs` answers one question: which rung of the contract's ladder an issue is on.
`forge guide contract` says what each rung is for and what none of them may buy. This file carries
the one rule that runs through every function there and would otherwise be six comments saying it
six ways.

## One source, and why it is the field

A rung is claimed once: by the `complexity` the tracker holds for the issue, five values wide, each
claiming one rung — the smallest a `trivial`, the next a `fix`, the top three a `feature`, since a
feature is everything else. An issue holding none is a `feature`, the top rung being what an
unclaimed issue falls to, and `forge advance --owed` names the value that claimed it.

The rung is also the height the lane is printed at — the statuses ahead of an issue with what earns
each — so it reaches `forge claim` and `forge resume` as well, and a correction that climbs changes
what all three say the statuses ahead are owed. Which is why the claim reads the issue's comment page
for a rung it once had no use for.

The body used to claim one too, on a `Size:` line, and two sources for one switch is a precedence
rule, a report about which of them lost, and an undo that only half works: the field said `xs`, the
body said `feature`, and neither a run nor a reader could say which the checks would run. So the
line is read by nothing. Bodies already carrying one are not edited — the line is prose now, claiming
nothing — and `forge issue ISS-nn --set complexity=<value> --why <w>` is how one that was only ever
marked in its body gets the field. An upward correction still outranks the field, and a cut comment
page is still a `feature` whatever the field says.

The two largest of the five values also earn a question rather than a payload: one change, or
several? What a rung owes is the contract's, and a report that grew a demand of its own would be a
second ladder.

## The rule

**Where the reading is doubtful, the answer is the rung that owes more.** Every input this module
can be unsure about resolves upward, and the argument is the same each time: being wrong upward
costs a run a payload it did not need to write, and being wrong downward costs the record something
nobody established. The first is a round; the second is a status that claims what no one checked.

Where it applies, and what each case would have done read the other way:

| The doubt | Resolved | Read downward it would have |
|---|---|---|
| an issue holding no complexity | `feature`, the rung that owes most | read an unset field as the rung that owes least, so an issue nobody sized is the cheapest one on the backlog |
| a comment page the tracker cut | `feature`, whatever the field says | lose a re-size the cut hid, shrinking a shortfall every other check can only grow |
| a correction naming a pair | only where the pair climbs | let `feature -> fix` raise a trivial to a fix, reading where it points and never where it came from |
| several climbs on one page | the highest | take the newest, so a plan correction written after a re-size erases it (ISS-161) |
| a word the ladder has not got | the height of the lowest rung, never negative | index off the end of the table and answer with nothing |
| a complexity the table has not got | no claim at all, so the rung is a `feature` | invent a rung for a value nobody mapped, and read it as the one that owes least |
| a run's transcript naming several rungs | the largest among them | file a batch under its cheapest member, so every rung looks better the more work is batched onto it |
| a plan declaring one name twice | `yes`, wherever outside a code span it stands | read the first, so `no` above `yes` waives a payload the plan explicitly declared, and the same two lines reordered do not |
| a ceiling read from a projection that lost a correction | printed all the same | the loss only ever lowers the rung, so it tightens a print that refuses nothing: it nags where nothing was owed and never falls silent where something was |

## The ship's ceiling

`tools/run.mjs` prints the landed file and line count against the rung's ceiling, and it is the
backstop rather than the decision: by the time a ship runs, a refusal protects nothing, so it prints
and returns. It is contained whole for the same reason — the release has already happened by the
time it runs, and an advisory number is not worth the lines that say what landed. Every doubtful
read makes it silent rather than loud: an unnamed branch, a tracker that could not answer, an answer
that is not an object. The one loss it accepts is the correction page's, which carries the latest
correction of its kind and no earlier one, so a re-size an ordinary correction followed is not read
here. That loss is one-directional — a dropped correction only ever lowers the rung, which tightens
a print that refuses nothing, so it nags where nothing was owed and never falls silent where
something was.

## Two readings the rule does not govern

**A declaration a plan quotes is not a doubtful declaration — it is not a declaration.** An inline
code span is blanked before the three names are looked for, because a plan is written under the rule
it explains and one citing what another issue declared would otherwise declare it too. Answering with
the higher of the spanned and unspanned readings would be worse than either: no plan could name the
value it is not, and the rule would be unwritable in the document that states it. Both halves of
`plugin/src/flow/machine.mjs` read one span for this — what the protector leaves alone crossing a
prose rewrite is what the reader refuses to count — which is why the protection it applies is a mark
it takes back rather than a span it leaves behind.

**A line a call printed is not a field a write stamped.** A run's rung is read off the confirmation
record in the call's output — its tag and its fence — and never off the words in it. A class covers
the whole shell call, so `forge record confirmation …; printf 'tier: feature'` is a confirmation
whose output carries a rung nothing stamped; and `blockOf` indents every continuation line of a
multi-line value, so a sentence somebody typed under `detail` carries the key as well. Neither is an
ambiguous reading resolved the wrong way, it is reading the wrong text. The record a write printed is
the first in that output, so a call chaining two writes reports the first rather than the larger:
that keeps the batch rule across calls, where each write is one, and drops it inside a single call,
where taking the largest record in the output would let a thread read after the write file the run at
another issue's rung.

## What the rule is not

It is not a licence to escalate. The rungs are claimed by meaning — one tree and nothing a person
sees, one behaviour and its replacement, or everything else — and that claim is the author's. This
rule decides only what to do when the *reading* is ambiguous, never when the claim is merely small.

Nor is urgency an input to it. Priority is the order `forge next` ranks by and it reaches no rung:
an urgent change whose meaning is new behaviour, or a screen, is a `feature` at the top of the queue,
and a one-line fix nobody is waiting for is still a `fix`. So there is no rung for a hotfix, and the
way to make an urgent change cheap is to make it small — `bandFor` writes the rung back as a
complexity, and the two axes meet nowhere else.

Nor does it reach the ceiling. `CEILINGS` is arithmetic the ship prints after the judging, and it
refuses nothing: by then a refusal would have nothing left to protect, and the correction is the
run's to write.
