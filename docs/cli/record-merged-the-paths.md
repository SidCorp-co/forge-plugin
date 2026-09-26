# `forge record merged` — the two clauses that hold paths

The merged mark rides in the audit comment the tracker writes, as one sentence of prose whose five
clauses the next two statuses read values back out of. Two of the five hold paths rather than a sha:
`landing moved`, which `testing` reads for whether the landing moved a path this change touched, and
`landing wrote`, which `developed` reads for what this change itself landed. This file carries what
may go in those two, how the sentence is fitted to the room the tracker gives it, and which step
computes each of them. Why the mark is a verb rather than a template, and what each of the five
clauses answers: [the mark](record-merged.md).

## What a path clause may hold

A path clause takes paths separated by commas, or the word `nothing`. Silence and none are different
answers: a clause that parses to no path at all says nothing about what moved, and a verdict at the
judged head then has nothing saying it survived the landing. That is why the verb refuses a clause
whose value parses to no path rather than storing the empty string.

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

## `landing moved` is git's reading, and the write takes it

The clause is what lets a verdict at the judged head stand across the landing, so it is not a run's
to assert. It was: a run whose `--no-ff` merge resolved nothing, and whose merge commit therefore
carried the judged head's own tree object, listed every path the merge touched and re-owed
twenty-six verdicts about identical bytes; and the landing task wrote the paths a reconcile had read
beside a judged head that was the reconciled candidate itself, standing down the verdicts the
builder took there (ISS-1362).

So `forge record merged` reads it: the `--wrote` paths whose bytes differ between `--judged` and
`--at`, from git in the checkout it runs in, and a mark written without `--moved` carries that
reading. The flag stays for a caller who has a value, and a typed one is compared rather than dropped:
one that differs is refused with git's value. It is not required, because a value the verb computes
anyway is one a caller can only guess at and learn from a refusal (ISS-2485). A checkout that cannot
read either commit is refused with the fetch that fixes it, whether or not the flag was typed, and
never falls back to an empty clause. The landing task asks the same question of the candidate the
change landed as, leaving out the version commit a release puts above it and the paths a release
moved only in its own version fields (ISS-2516) and the paths the landed head's own generators write
back (ISS-1421), so it composes the note with that reading rather than going through the verb.

It reads the change's own paths and not the whole tree. An identical tree reads as nothing moved,
and so does a landing that moved only a neighbour: what the verdicts judged was the change's paths,
and the tree around them is what the review and the reconcile read at the landed head.

`landing wrote` is still computed at the one step that knows what landed, and never earlier: where
the landing is a release it writes files of its own on top of the change, and a clause answered
before the version commit exists is answered about a landing that has not happened (ISS-1896).
