# `stats runs` — a compaction and an API error, a run's condition and not its cost

Two more records sit in the transcript the corpus reader already walks for its calls and its tokens,
and neither of them is a call at all. `isCompactSummary` on a user record is the host losing what a
run knew — the context ceiling reached, its history rewritten into a summary — and the run carrying
on from there. `isApiErrorMessage` on an assistant record is a request that came back as an error
rather than an answer, always under the marker model the token tally already drops, so it was never
a measured request either. Measured against this project's own corpus the week this was filed:
compactions fell from 127 across 58 of 272 runs to 30 across 16 of 280 — one run in five hitting the
ceiling, down to one in eighteen — while API errors rose, on three independent projects at once.

## Why neither reaches the refusals listing or the other-errors line

[stats — the rows](stats-rows.md) keys a refusal on the line that names the rule and counts every
other non-zero exit apart from it, by the class of the call that exited. Both readings are of a
*call* — something this plugin's own harness issued and a result came back for, answered or not. A
compaction record and an API-error record are neither: the first carries no `tool_use` block for
this reader to have ever opened, and the second is a message-level event under a model no run
dispatches to. There was no call to key a refusal on or to file under a class, so the two are counted
on their own pass, apart from both listings, and the network is asked nothing either way.

## Why compactions print as two counts and not one

A run that lost its history three times is one run that ran out of room, not three runs that did.
The count of compactions and the count of runs that met at least one move independently — a corpus
where every compacting run compacted twice would halve the second without moving the first at all —
and folding them into one number would hide exactly that movement. `forge stats runs` prints both,
and `--json` carries them as `condition.compactions.met` and `condition.compactions.runs`.

## Why neither figure is folded into the angle set

Every angle [stats — the angles](stats-the-angles.md) holds is a price — `better: -1` over what a
run *spent* — and a compaction is not spending: it is a run that carried on from a worse position
than the one it had, which is a fact about the run's own *condition* rather than its cost. That makes
it closer to a quality signal than anything the angle set holds, and it is exactly for that reason
that it earns no verdict against this corpus's own floor: doing so would read as though it had passed
the six conditions that topic holds a quality figure to, foremost among them that a quality reading
tests an artefact's outcome against criteria fixed independently of the run — and a compaction count
tests neither an artefact nor an outcome. So it prints beside the cost figures, with no disposition,
no floor and no verdict of its own, and the angle topic's closed set of eight stays closed around it.

## Why an empty population is unavailable and not a clean nought

Where the window holds no run there is nothing to have compacted and no request to have failed,
which is a different sentence from "nothing went wrong" — a reader cannot tell the two apart from a
bare zero, and a week with no runs at all would otherwise read as a run's condition that improved.
So both figures print as unavailable there, the same rule the token medians and the outcome figures
already keep.
