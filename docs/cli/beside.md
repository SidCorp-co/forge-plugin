# What is already open beside a filing

**The check an agent remembers to make is the one that was not made.** On 2026-09-04 two defects in
the same file, both at the fix rung, were filed an hour apart by two runs that never saw each other's issue, and
each would have cost a full round of the flow for a change of a few lines. Later the same day a run
filed a defect that an issue already open described, and the duplicate was found by a person reading
the backlog afterwards. Nothing was broken in either case: the create path simply never asked. So
the asking moved into the create path, where a filer who skipped it is covered anyway.

**Two questions, because the embedding answers only one of them.** Measured against this project's
own memory: with a filing's title and first section as the query, the semantic strategy ranked the
issue it duplicated second, above every unrelated neighbour — topic is what the vector knows. The
same query in the keyword strategy returned nothing at all, prose being no term index; a path or a
verb name returned exactly the issues naming it. So what a filing is *about* and what it is *in* are
asked separately, and only the second is a place.

**The place is read off the cause before it is read off *Where*.** A symptom shows in one file and
comes from another, and the twenty-odd duplicate filings of 2026-09-06 and 2026-09-07 each named a
different symptom of a cause an open issue had already named — the credential line under five
titles, the `.log` refusal under nine. *Where* is where a reader goes to reproduce it; the cause is
what the second report shares with the first, so it is the term the fold's destination is chosen on.
The chain still ends where it always did: a body naming no cause, or a cause naming no path or verb,
is measured off *Where* and then off its own first token, so nothing filed under the older shape is
measured anywhere new.

**Two thresholds, because a glance and a comment cost differently.** The duplicate came back at
0.830 and the filing's own already-indexed self at 0.891; the range from 0.70 to 0.74 held
neighbours by machinery rather than by subject — the ship script, the review mark, the verdict
record — and nothing at all fell between 0.74 and 0.83. A neighbour is worth printing from 0.70,
because a machinery neighbour costs a reader one glance and printing nothing costs them the
duplicate. Landing a filing on one takes 0.78, in the middle of that measured gap, because the
range the printing tolerates is exactly the range where the subject is known not to match. One
threshold for both would have folded onto a machinery neighbour and called it the subject.

**Which filings then land on a neighbour, on what condition, and what that act costs:**
[`the-fold`](the-fold.md). Nothing on this page decides it, and the mark is not among the answers.

**Printed on every filing, including the folded one and the one that found nothing — and printed
before the line saying what became of the body.** A fold's reply names its destination and the block
above it says what else was open, with the titles and the scores: a filing whose body went somewhere
unexpected is the filing whose neighbours most want reading, and the order that guarantees it sees
them is [`the-fold`](the-fold.md)'s. One print on every one of the four
outcomes, from one place, rather than one per branch that remembered. `--new` closes the block on
every outcome, and it answers two questions rather than one —
whether a neighbour qualified, and whether this filing could have folded onto it at all — because
one answer for both reports a backlog nobody read. A filer told nothing cannot tell
a backlog with nothing like their filing from a check that never ran, and the second is the one
worth knowing — it means the next filing is unmeasured too. A search the tracker refuses, or one the
transport loses, says which query failed and that the filing was made as it would have been without
it. Nothing here refuses a filing: a duplicate filed anyway is a duplicate its filer was shown.

**The key, the title and the open-ness are the projection's, never the hit's.** A hit carries the
issue's uuid, its score and the text as it was embedded — and not its key, not its status, and not a
title that has moved since. A closed issue comes back ranked like any other, and one retitled after
indexing comes back under its old title marked fresh. So every hit is resolved by uuid against the
open-issues page the duplicate check already fetched, which is the same call rather than a second
one, and a hit that resolves to nothing open is not a suggestion.

**A gateway status here may not kill the filing.** The soft call every other verb uses converts the
tracker's own refusal and not the transport's, because the transport's exits the process — right for
a verb whose whole job is the call, and wrong for a check running beside a write that has to land: a
dropped socket would have taken the filing with it, and a body that arrived on stdin cannot be sent
again. So this read answers with a refusal whatever refused it, and it is retried like the read it
is: which a call is, is declared on its own row rather than guessed from the shape of its payload.

**`forge comment` never reaches any of this.** It names its target, so there is nothing to suggest
and nothing to decline, and it asks the tracker no question about neighbours at all.
