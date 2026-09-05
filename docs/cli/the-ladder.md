# The ladder — three rungs, and why every doubtful reading resolves upward

`plugin/src/ladder.mjs` answers one question: which rung of the contract's ladder an issue is on.
`forge guide contract` says what each rung is for and what none of them may buy. This file carries
the one rule that runs through every function there and would otherwise be six comments saying it
six ways.

## The two sources, and which of them decides

A rung is claimed twice over. The tracker holds a size per issue, five values wide, and each claims
one rung: the smallest a `trivial`, the next a `fix`, the top three a `feature`, since a feature is
everything else. The body holds a `Size:` line, which is what carries every issue filed before that
field could be read back, and what a person types on a screen with no CLI to hand. `forge new`
writes both at once from whichever the filer gave, so anything filed through this CLI leaves them
agreeing; a hand edit to either is the only way they come apart.

Where they do, **the higher rung wins, and the report says which source lost.** Not a precedence
rule — the same arithmetic that already reads a correction, applied to one more input, so an unset
size falls back to the mark and a set one lifts an unmarked issue off the top rung. The argument for
the direction is the one below, spent on a different input: three statuses ask less of the rungs
under `feature`, and they are asked at different points of the run. A rung lowered after the plan
would make a later status demand less than an earlier one already established — a status claiming
what nobody checked, which is the cost this whole file exists to avoid. An upward correction still
outranks both, and a cut comment page is still a `feature` whatever either source says.

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
| a description carrying two marks | the highest of them | let whichever the reader found first decide, so `Size: fix.` above `Size: trivial.` is a trivial and the same body reordered is a fix |
| a description marking the top rung | that rung, which is writable like any other | read `Size: feature.` as no mark at all, so a body claiming it beside a lower one reads as the lower — and this repository's own issues write it in full |
| a comment page the tracker cut | `feature`, whatever the mark says | lose a re-size the cut hid, shrinking a shortfall every other check can only grow |
| a correction naming a pair | only where the pair climbs | let `feature -> fix` raise a trivial to a fix, reading where it points and never where it came from |
| several climbs on one page | the highest | take the newest, so a plan correction written after a re-size erases it (ISS-161) |
| a word the ladder has not got | the height of the lowest rung, never negative | index off the end of the table and answer with nothing |
| a size value the table has not got | no claim from that source, so the mark decides alone | invent a rung for a value nobody mapped, and read it as the one that owes least |
| a run's transcript naming several rungs | the largest among them | file a batch under its cheapest member, so every rung looks better the more work is batched onto it |
| a plan declaring one name twice | `yes`, wherever in the plan it stands | read the first, so `no` above `yes` waives a payload the plan explicitly declared, and the same two lines reordered do not |
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

**A mark inside an example is not a doubtful mark — it is not a mark.** A fenced or indented block
is stripped before the mark is looked for, because the contract's own guide prints the syntax and a
body quoting it would otherwise claim whatever rung it quoted. Answering with the higher of the
stripped and unstripped readings would be worse than either: an example naming `feature` would then
raise a rung the body genuinely claimed, and no trivial issue could ever quote the mark. A wall
closes on its own character, at least as long as the one that opened it and alone on its line:
anything looser ends the block at a line of content and reads the mark under it as the body's. A
block nothing closes runs to the end of the text, so what that loses, it loses upward.

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

Nor does it reach the ceiling. `CEILINGS` is arithmetic the ship prints after the judging, and it
refuses nothing: by then a refusal would have nothing left to protect, and the correction is the
run's to write.
