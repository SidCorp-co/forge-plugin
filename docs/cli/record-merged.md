# `forge record merged` — five clauses, one table that writes and reads them

The merged mark is the one payload of this contract the tracker owns rather than a comment: `POST
/issues/:id/merge` stamps the time, sets `mergedAt` and writes an audit comment of its own. What the
mark *says* rides in that comment, as one sentence of prose, and three entry checks read values back
out of it. `forge record merged -h` prints the flags. This file carries why the sentence is composed
where it is parsed, and what each clause is for. What may go in the two clauses that hold paths,
which step computes each of them and how the sentence is fitted to the room the tracker gives it:
[the path clauses](record-merged-the-paths.md).

## Why a verb, and not a template

Before ISS-701 no verb wrote the mark. A run composed the sentence by hand from a template a
refusal printed, and the refusal was the only statement of the shape anywhere — so the sentence had
one author per run. Two clauses of it hold a sha and a third holds another, and a sha in the wrong
slot is not refused by the write: it is refused two statuses later, by `testing`, saying the verdicts
judged a head the mark does not name. The cost lands a phase away from the mistake, on whoever is
trying to ship.

The clauses are a table now — flag, the words the note is written and read by, and what the clause
holds — and `plugin/src/flow/record/merged.mjs` builds the regexes off the same rows the composer joins.
A clause cannot be spelt two ways because there is one spelling. The verb refuses every absent
clause at once rather than one per round, because a run types four flags and learning them one
refusal at a time is three rounds nobody gets back. The fifth, `landing moved`, is not a run's to
type at all: the verb reads it from git, for the reason [the path clauses](record-merged-the-paths.md)
gives.

## The landing task writes it through the same call

`tools/run/land-ready.mjs` marks the issue as part of the landing, in process, and it had its own
copy of the sentence. It calls `markNote` and `markMerged` now.

What a checker can hold here is the tracker's write and not the prose: `plugin/src/checks/one-writer.mjs`
claims `mark_merged` and `unmark` for that module, so a second *caller of the action* fails it. A
caller that composed its own sentence and handed it to `markMerged` would pass, which is why the
composer lives in the same module as the parsers and why this is the only place that says so. That
is the whole argument for one module holding the write and the read together: neither half can move
without the other.

## What each clause answers

| Clause | Read by | What it decides |
|---|---|---|
| `at <sha>` | `developed`, and every record that reads `--commit` off the mark | which commit landed; a mark naming none earns nothing |
| `reviewed head <sha>` | `developed` | the head the review judged, so a squash that changed the hash still matches an approving review |
| `judged head <sha>` | `testing` | the head the verdicts were taken at, which is what lets a verdict stand across the landing |
| `landing moved <paths>` | `testing` | whether the landing moved a path this change touched, as git reads it; empty is what makes the verdicts stand, and *silence is not empty* |
| `landing wrote <paths>` | `developed` | what this change itself landed, so a path neither the plan nor a correction names refuses the status |

## Marks already on the tracker still earn

The parser is unchanged, byte for byte, and the verb writes the sentence it already read. Every mark
written by hand under the old template reads back the same, so no issue mid-flow has to be re-marked
and nothing on the tracker was rewritten by this change.

## `--undo` is the one route back

It calls the tracker's `DELETE` on the same route, prints the note it removed, and takes no clause
beside it — a clause is written by the mark and not by its removal. It is what `forge advance --drop`
prints when a marked issue is asked to drop, because dropped means no code landed: revert the commit,
remove the mark, then drop from `approved`.

Nothing here rolls the *commit* back. The mark is a claim about a commit, so removing it says the
claim was wrong and never that the code is gone.

It asks the row and not only the page, because a tracker may stamp the merge itself on a close and
that stamp writes no mark to find: asking for the mark alone shut this route against exactly the rows
carrying a landing nothing made, which is how three of them stood a day with no way back (ISS-2125).
Where there is no mark to quote, what comes back names where the stamp came from instead.
