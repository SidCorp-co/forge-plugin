# What is already open beside a filing

**The check an agent remembers to make is the one that was not made.** On 2026-09-04 two fix-size
defects in the same file were filed an hour apart by two runs that never saw each other's issue, and
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

**Two thresholds, because a glance and a comment cost differently.** The duplicate came back at
0.830 and the filing's own already-indexed self at 0.891; the band from 0.70 to 0.74 held
neighbours by machinery rather than by subject — the ship script, the review mark, the verdict
record — and nothing at all fell between 0.74 and 0.83. A neighbour is worth printing from 0.70,
because a machinery neighbour costs a reader one glance and printing nothing costs them the
duplicate. Landing a filing on one takes 0.78, in the middle of that measured gap, because the
band the printing tolerates is exactly the band where the subject is known not to match. One
threshold for both would have folded onto a machinery neighbour and called it the subject.

**The fold asks for both signals on one issue, and that is a price paid deliberately.** A comment is
the one write this CLI has no verb to take back, so the issue a fix-size filing lands on has to be
the one it is about *and* the one it is in — the nearest of the neighbours naming its place, which
is not the nearest of all, and no reply here says otherwise. The place query cannot rank: every hit it returns comes
back at the same score — seven issues naming one path, all at 0.0608 — so on its own it would choose
whichever the tracker listed first, and a place as broad as a common verb returns ten
undifferentiated issues. Left to the place alone the fold would eventually post a finding onto an
issue with nothing to do with it, and the finding would be lost exactly the way filing it twice
loses it.

**So the fold reaches neither of the two cases that motivated it, and the block is what covers
them.** The two same-file defects share no subject — each one's nearest neighbours are its own
topic's, and neither reaches the other above the floor — and one of them names the file only in
prose, so the place query misses it too. The duplicate pair shares a subject at 0.830 and no place:
the section naming its place named a verb broad enough to return ten issues, none of them the one it
duplicated. Both would have been filed. What changes is that the second filer would have been shown
the issue they were duplicating, on their own screen, while the command was still in their hand.
That is the whole of what this buys, and it is worth saying plainly rather than claiming a fold that
fires more often than it does.

**Printed on every filing, including the folded one and the one that found nothing.** A fold's
reply names its destination and the block under it says what else was open, with the titles and the
scores: a filing whose body went somewhere unexpected is the filing whose neighbours most want
reading. `--new` closes the block on every outcome, and it answers two questions rather than one —
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
again. So this read answers with a refusal whatever refused it. Along the way, a read named by its
tool rather than by an action field stopped being read as a write: it is retried like the read it is,
and no longer warns that it may have been processed.

**The defect route folds on a measure although its title match is exact, and that reverses what
[`feedback`](feedback.md) says about it.** The reason the title match is exact still holds — a caller
cannot predict an overlap score, and a note appended to an unrelated issue is the note lost again.
What answers it is that the fold's condition is not one score but two independent ones on the same
issue, that the reply names the issue it joined and what it was measured against, and that `--new`
is a route a filer can predict and take. The title match is still asked first: a note whose title is
already open belongs there whatever the memory says.

**A destination nobody chose is read before it is written to.** The hold every write to an issue
takes — the thread delivered once, then the same command again — costs a fold one round and buys the
thing the fold's own uncertainty makes worth buying: a thread already carrying this finding, or
saying the issue was rescoped since. The named route takes that hold, so the guessed one cannot
take less; and the body is registered before the first read, so the hold prints it back rather than
losing it. It is the exact-title match on the defect route that stays exempt, and only that: there
the filer typed the destination.

**`--into` never reaches any of this.** It names its target, so there is nothing to suggest and
nothing to decline, and it asks the tracker no question about neighbours at all.
