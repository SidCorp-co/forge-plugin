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

## `--at` is checked against the base branch as fetched

A head that exists only on the builder's own branch is no landing, however cleanly git reads it in
that checkout — which is what a delegated run's own `forge record merged` hit on ISS-1480, marking a
commit that never reached `origin/master` and walking the issue through three rungs on a landing
that never happened. `markMerged` takes whatever note it is handed and never asks where its commit
sits, the ancestry being this verb's question and not the tracker's write (`plugin/src/checks/one-writer.mjs`
above); the check sits in `mergedPrepared` alone, so it never reaches the landing task's own call through `markMerged` — the
candidate that call marks is one this checkout only just pushed, and asking it to already be
`origin/<branch>`'s ancestor would refuse a landing for a fetch that has not happened yet.

The read is `git merge-base --is-ancestor <the --at sha> origin/<the branch the note names>`, in the
checkout the verb runs in, never a local branch of that name which a stale checkout could have moved
anywhere. Three answers:

- **It does.** The mark is written as asked.
- **It does not.** Refused, naming the branch, where it stands, and the route left: under a project
  whose ship mode leaves the landing to another actor, that there is none — the mark is the
  landing's to write, and what stands ready for it is the checkpoint `forge claim --pushed --ready`
  leaves; everywhere else, that the change is landed for real, onto that branch, before the same
  mark is asked for again.
- **Nothing here can tell.** A shallow checkout, or git erroring on the read, refuses the same way
  rather than guessing either pass or fail — the fetch that would settle it is named.

Where this checkout has never fetched `origin/<branch>` at all there is no ref to read the ancestry
off, so none of the above fires and the mark stands exactly as it did before this check existed: the
tracker's own "a claim Forge did not observe" line is what a reader already sees there.

## The commit travels as the tracker's own field too

The mark sends the commit it names as the tracker's typed `commit` field beside the note, and a
stamp already standing refuses a mark the tracker would not stamp: [the commit field](record-merged-the-commit.md).

## What each clause answers

| Clause | Read by | What it decides |
|---|---|---|
| `at <sha>` | `developed`, and every record that reads `--commit` off the mark, on an issue landing in git | which commit landed; a mark naming none earns nothing |
| `reviewed head <sha>` | `developed` | the head the review judged, so a squash that changed the hash still matches an approving review |
| `judged head <sha>`, or `judged head nothing` | `testing` | the head the verdicts were taken at, which is what lets a verdict stand across the landing; `nothing` stands none, and every verdict is then owed at the landed commit |
| `landing moved <paths>` | `testing` | whether the landing moved a path this change touched, as git reads it; empty is what makes the verdicts stand, and *silence is not empty* |
| `landing wrote <paths>` | `developed` | what this change itself landed, so a path neither the plan nor a correction names refuses the status |

## A judged head nobody has taken yet

Where the judgement between `developed` and `testing` is another run's, the builder writes the mark
before any verdict exists, and a clause that only took a sha made it name one nobody judged: filed
again from project after project, the duplicates folded onto ISS-1960. `--judged` takes `nothing`
there, and the note says in words that no verdict has judged a head.

The word is keyed to the page and not to the project's judgement setting. It is true wherever no
verdict stands and false wherever one does, whichever run a project made the judge: a setting-keyed
rule refuses the truth to a builder-judged run that marks before judging, and lets an
independent-judgement builder that wrote verdicts anyway drop the head they judged. So it is refused
where the page carries a verdict, naming the heads those verdicts judged.

With no judged head, `landing moved` is read from the reviewed head, which is where the change stood
before the landing. No reader takes that clause without a judged head, so there it reports what moved
and stands no verdict up or down.

## Marks already on the tracker still earn

The parser is unchanged, byte for byte, and the verb writes the sentence it already read. Every mark
written by hand under the old template reads back the same, so no issue mid-flow has to be re-marked
and nothing on the tracker was rewritten by this change.

## A change that landed outside git

An issue the tracker says lands outside git is marked with `--landing` alone, and none of the five
clauses above: [the outside-git mark](record-merged-outside-git.md).

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
