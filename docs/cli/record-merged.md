# `forge record merged` — five clauses, one table that writes and reads them

The merged mark is the one payload of this contract the tracker owns rather than a comment: `POST
/issues/:id/merge` stamps the time, sets `mergedAt` and writes an audit comment of its own. What the
mark *says* rides in that comment, as one sentence of prose, and three entry checks read values back
out of it. `forge record merged -h` prints the flags. This file carries why the sentence is composed
where it is parsed, and what each clause is for.

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
clause at once rather than one per round, because a run types five flags and learning them one
refusal at a time is four rounds nobody gets back.

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
| `landing moved <paths>` | `testing` | whether the landing moved a path this change touched; empty is what makes the verdicts stand, and *silence is not empty* |
| `landing wrote <paths>` | `developed` | what this change itself landed, so a path neither the plan nor a correction names refuses the status |

A path clause takes paths separated by commas, or the word `nothing`. Silence and none are different
answers: a clause that parses to no path at all says nothing about what moved, and a verdict at the
judged head then has nothing saying it survived the landing. That is why the verb refuses a clause
whose value parses to no path rather than storing the empty string.

## What a path clause may hold

Whitespace is what tells a path from a phrase, and a typed value holding it is refused. The reason
the question came up: the ship printed the clause the note would carry, `landing moved nothing`,
under the words *type that clause whole*, and the run that did got a mark naming a path of that name
— so `testing` reported nine verdicts as taken before that path moved and offered nine
fresh verdicts as the way out (ISS-1023). Three things follow.

**The refusal is where the value is typed.** A record that says the wrong thing about a set of paths
is worth catching at the write; the status that reads it is three rungs away from the typo, and what
clears it there is `--undo` and a second mark rather than anything that refusal can name.

**It is asked of the shape and never of the filesystem.** A path this change wrote and a later
commit deleted is still what the landing wrote, and a path no tree ever held is refused by
`developed` reading it against the plan, which is that check's question and not this one's.

**And it is the flag's alone.** The landing task hands the composer paths off `git diff`, where a
space in a name is the tree's business and not a typo, and every clause word the note is read by
needs a space to collide — so barring whitespace in the composer would leave the read-back refusal
above unreachable for a path clause. What the composer refuses is what no path may hold wherever the
note is built: a separator the note is read by, and the word a clause takes for none, which alone
reads as a landing that moved none and beside a path says both and so neither.

The ship prints the flag and the value `forge record merged` takes for it, rather than the clause the
note will carry, for the same reason the refusal exists: a printed clause holds the template and the
value in one sentence, and nothing but this page told a run which words were which.

## The note is built to the room the tracker gives it

The tracker takes 2000 code points of note on that route, and a change of some forty-five paths is
already past it. The number is the route table's `note` cap, read where every other field's cap is
read, so a tracker that raises it is one table edit and not a search for the composer that decided
otherwise.

So the composer fits the sentence, and what it leaves out it leaves out by a rule. `developed` reads
each path of `landing wrote` against the plan and its corrections and refuses one they do not name:
a path they *do* name is one that check already passes, and dropping it changes no answer, while a
path they do not name is the whole evidence that the change grew. Every unnamed path therefore stays
in the clause, the named ones fill what room is left, and a clause of its own — after the `;`, where
no reader takes it for a path — says how many of the change's paths are in the note, how many are
not, that the plan names those, and where the whole list is read from.

Two notes are refused before the call rather than fitted, because fitting either would say something
untrue:

- one whose unnamed paths alone overrun it. Shortening there would earn `developed` for a change
  that grew and never disclosed it, so the refusal names those paths and the correction that clears
  them — which is the correction the status asks for anyway, and once it is written they are named
  and the note has room to leave them out.
- one whose `landing moved` clause has no room for a single written path. That clause is what stands
  the verdicts down, and a partial list of it reads as a landing that moved less than it did.

A run following the ship's last step types the flag and the value it printed, whole. The improvisation this replaced —
a shorter note invented per run, because the printed instruction was refused by the write it asked
for — is what made the record of a large change whatever its run had time to type.

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
