# `stats runs` — a compaction, an API error and a human prompt: a run's condition and not its cost

Three more records sit in the transcript the corpus reader already walks for its calls and its
tokens, and none of them is a call at all. `isCompactSummary` on a user record is the host losing
what a run knew — the context ceiling reached, its history rewritten into a summary — and the run
carrying on from there. `isApiErrorMessage` on an assistant record is a request that came back as an
error rather than an answer, always under the marker model the token tally already drops, so it was
never a measured request either. `isHumanPrompt`, imported from `hooks/transcripts.mjs` rather than
reimplemented — the reader the stop-check gate uses to tell a real human turn apart from a tool
result and a harness-written record — is a person present inside a run this harness dispatched.
Measured against this project's own corpus the week this was filed: compactions fell from 127 across
58 of 272 runs to 30 across 16 of 280 — one run in five hitting the ceiling, down to one in eighteen
— API errors rose, on three independent projects at once, and 275 of 280 run transcripts carried no
human prompt at all.

## Why none of the three reaches the refusals listing or the other-errors line

[stats — the refusals](stats-the-refusals.md) keys a refusal on the line that names the rule and counts every
other non-zero exit apart from it, by the class of the call that exited. All three readings are of a
*call* — something this plugin's own harness issued and a result came back for, answered or not. A
compaction record, an API-error record and a human-prompt record are none of them: the first carries
no `tool_use` block for this reader to have ever opened, the second is a message-level event under a
model no run dispatches to, and the third is a message-level event under no model at all. There was
no call to key a refusal on or to file under a class, so all three are counted on their own pass,
apart from both listings, and the network is asked nothing either way.

## Why compactions and human prompts print as two counts and not one

A run that lost its history three times is one run that ran out of room, not three runs that did,
and a run a person spoke inside twice is one run holding a person and not two. The count of
compactions and the count of runs that met at least one move independently — a corpus where every
compacting run compacted twice would halve the second without moving the first at all — and folding
them into one number would hide exactly that movement; a human-typed turn moves the same way, a
follow-up steer inside one run being no more a second run than a second compaction is. `forge stats
runs` prints both pairs, and `--json` carries them as `condition.compactions.met` /
`condition.compactions.runs` and `condition.humanPrompts.met` / `condition.humanPrompts.runs`.

## Why the runs a human prompt showed up inside are named rather than counted alone

At the count this figure holds on a real corpus — five of two hundred and eighty runs the week it
was measured — a reader can go and look at each one, and folding them into a rate would be the one
thing this figure exists not to do: a rate that reads 2% either says too little to act on or hides
the handful of cases that are the only ones worth reading. So `condition.humanPrompts.named` carries
one entry per such run, by the issue it claimed (`claimedIn`, the same join the eval uses) or, where
it claimed none, by its own session — the identifier a reader still has something to open — and the
screen lists them under the reading rather than leaving the count to stand for them.

**A prompt inside a run and a run that is itself a person's session are not the same fact, and this
one only ever holds the first.** The corpus this verb reads is subagent transcripts alone — `forge
stats runs`' own admission test never reaches a top-level, interactively driven session — so every
run this figure is taken over is one this harness dispatched. What the count answers is whether a
person's own turn shows up *inside* such a run, a follow-up steer sent while it was running, and
never whether the run was a person's session from the start; the corpus holds nothing of the second
kind to count.

## Why none of the three figures is folded into the angle set

Every angle [stats — the angles](stats-the-angles.md) holds is a price — `better: -1` over what a
run *spent* — and none of these three is spending: a compaction is a run that carried on from a
worse position than the one it had, an API error is a request the run never got to spend, and a
human prompt is a fact about who was present rather than about what the run did. That makes
compactions and API errors closer to a quality signal than anything the angle set holds, and it is
exactly for that reason that neither earns a verdict against this corpus's own floor: doing so would
read as though it had passed the six conditions that topic holds a quality figure to, foremost among
them that a quality reading tests an artefact's outcome against criteria fixed independently of the
run, and neither count tests an artefact or an outcome.

The human-prompt count is ruled out on a different ground, stated on [stats — the
angles](stats-the-angles.md)'s own reopen-count precedent and not repeated here: at 275 of 280 runs
carrying none, it would sit almost constant against the angle floor's adjacent-shift comparison and
read `same` forever, which is the shape that ruled `reopenCount` out. But it is not a proxy the way
`reopenCount` was, and does not need the variance a comparison would ask for — G-11's target for it
is zero, so the count itself is the answer a conformance reading gives rather than a weak signal a
comparison would have to sharpen. That is why it is a reading here and not an angle there: the
angle set compares a window against its own history, and this figure is compared against a target
the project already states.

So all three print beside the cost figures, with no disposition, no floor and no verdict of their
own, and the angle topic's closed set of eight stays closed around them.

## Why an empty population is unavailable and not a clean nought

Where the window holds no run there is nothing to have compacted, no request to have failed and no
one to have spoken, which is a different sentence from "nothing went wrong" — a reader cannot tell
the two apart from a bare zero, and a week with no runs at all would otherwise read as a run's
condition that improved. So all three figures print as unavailable there, the same rule the token
medians and the outcome figures already keep, and the human-prompt figure's named list is empty
rather than absent.
